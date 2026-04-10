"""Relay client: passphrase generation, session creation, and polling."""

import asyncio
import base64
import json
import secrets
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import httpx
from cryptography.hazmat.primitives.asymmetric.ec import (
    EllipticCurvePrivateKey,
    EllipticCurvePublicKey,
)

from mcp_relay_core.crypto.aes import decrypt
from mcp_relay_core.crypto.ecdh import (
    derive_shared_secret,
    export_public_key,
    generate_key_pair,
    import_public_key,
)
from mcp_relay_core.crypto.kdf import derive_aes_key
from mcp_relay_core.relay.wordlist import WORDLIST
from mcp_relay_core.schema.types import RelayConfigSchema


def generate_passphrase(word_count: int = 4) -> str:
    """Generate a Diceware passphrase using the EFF long wordlist.

    Uses rejection sampling for uniform distribution.

    Args:
        word_count: Number of words (default 4 = ~52 bits entropy).

    Returns:
        Hyphen-separated passphrase string.
    """
    words: list[str] = []
    max_val = (0x10000 // len(WORDLIST)) * len(WORDLIST)
    for _ in range(word_count):
        while True:
            index = secrets.randbelow(0x10000)
            if index < max_val:
                break
        words.append(WORDLIST[index % len(WORDLIST)])
    return "-".join(words)


@dataclass
class RelaySession:
    """Active relay session state."""

    session_id: str
    private_key: EllipticCurvePrivateKey
    public_key: EllipticCurvePublicKey
    passphrase: str
    relay_url: str


async def create_session(
    relay_base_url: str,
    server_name: str,
    schema: RelayConfigSchema,
    oauth_state: dict[str, Any] | None = None,
) -> RelaySession:
    """Create a new relay session.

    Args:
        relay_base_url: Base URL of the relay server.
        server_name: Server identifier.
        schema: Relay config schema for the setup form.
        oauth_state: Optional OAuth 2.1 state for the provider flow.

    Returns:
        RelaySession with session ID, keys, passphrase, and relay URL.

    Raises:
        httpx.HTTPStatusError: If server returns non-2xx.
    """
    session_id = secrets.token_hex(32)
    private_key, public_key = generate_key_pair()
    passphrase = generate_passphrase()

    payload: dict[str, Any] = {
        "sessionId": session_id,
        "serverName": server_name,
        "schema": dict(schema),
    }
    if oauth_state:
        payload["oauthState"] = oauth_state

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{relay_base_url}/api/sessions",
            json=payload,
        )
        if response.status_code >= 400:
            msg = f"Relay session creation failed: {response.status_code}"
            raise RuntimeError(msg)

    pub_key_b64 = export_public_key(public_key)
    relay_url = (
        f"{relay_base_url}/setup?s={session_id}#k={pub_key_b64}&p={quote(passphrase)}"
    )

    return RelaySession(
        session_id=session_id,
        private_key=private_key,
        public_key=public_key,
        passphrase=passphrase,
        relay_url=relay_url,
    )


async def poll_for_result(
    relay_base_url: str,
    session: RelaySession,
    interval_s: float = 2.0,
    timeout_s: float = 600.0,
) -> dict[str, str]:
    """Poll the relay server for the result.

    Args:
        relay_base_url: Base URL of the relay server.
        session: Active RelaySession.
        interval_s: Polling interval in seconds.
        timeout_s: Maximum time to poll in seconds.

    Returns:
        Decrypted configuration dictionary.

    Raises:
        TimeoutError: If result is not available within timeout.
        RuntimeError: If session is skipped or server returns error.
    """
    deadline = asyncio.get_event_loop().time() + timeout_s

    while asyncio.get_event_loop().time() < deadline:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{relay_base_url}/api/sessions/{session.session_id}")

            if response.status_code == 200:
                body = response.json()

                if body.get("status") == "skipped":
                    await _cleanup_skipped_session(relay_base_url, session.session_id)
                    raise RuntimeError("RELAY_SKIPPED")

                return await _decrypt_relay_result(body, session)

            if response.status_code == 404:
                raise RuntimeError("Session expired or not found")
            if response.status_code != 202:
                raise RuntimeError(f"Unexpected status: {response.status_code}")

        await asyncio.sleep(interval_s)

    raise RuntimeError("Relay setup timed out")


async def _cleanup_skipped_session(relay_base_url: str, session_id: str) -> None:
    """Helper to delete a skipped session."""
    try:
        async with httpx.AsyncClient() as client:
            await client.delete(f"{relay_base_url}/api/sessions/{session_id}")
    except Exception:
        pass


async def _decrypt_relay_result(body: dict, session: RelaySession) -> dict[str, str]:
    """Helper to decrypt the encrypted result from the relay server."""
    result = body.get("result") or body
    browser_pub = result["browserPub"]
    ciphertext_b64 = result["ciphertext"]
    iv_b64 = result["iv"]
    tag_b64 = result["tag"]

    browser_key = import_public_key(browser_pub)
    shared_secret = derive_shared_secret(session.private_key, browser_key)
    aes_key = derive_aes_key(shared_secret, session.passphrase)

    plaintext = decrypt(
        aes_key,
        base64.b64decode(ciphertext_b64),
        base64.b64decode(iv_b64),
        base64.b64decode(tag_b64),
    )

    return json.loads(plaintext)


async def send_message(
    relay_base_url: str,
    session_id: str,
    message_type: str,
    text: str,
    data: dict[str, Any] | None = None,
) -> str:
    """Send a message to the browser via relay server.

    Args:
        relay_base_url: Base URL of the relay server.
        session_id: Active session ID.
        message_type: Message type identifier.
        text: Message text.
        data: Optional structured data.

    Returns:
        Created message ID.
    """
    payload: dict[str, Any] = {"type": message_type, "text": text}
    if data:
        payload["data"] = data

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{relay_base_url}/api/sessions/{session_id}/messages",
            json=payload,
        )
        if response.status_code >= 400:
            raise RuntimeError(f"Failed to send message: {response.status_code}")

        return response.json()["id"]


async def poll_for_responses(
    relay_base_url: str,
    session_id: str,
    message_id: str,
    interval_s: float = 2.0,
    timeout_s: float = 300.0,
) -> str:
    """Poll for a response to a specific message.

    Args:
        relay_base_url: Base URL of the relay server.
        session_id: Active session ID.
        message_id: Message ID to wait for.
        interval_s: Polling interval in seconds.
        timeout_s: Maximum time to poll in seconds.

    Returns:
        Response value string.

    Raises:
        TimeoutError: If response is not received within timeout.
    """
    deadline = asyncio.get_event_loop().time() + timeout_s

    while asyncio.get_event_loop().time() < deadline:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{relay_base_url}/api/sessions/{session_id}/responses"
            )
            if response.status_code >= 400:
                raise RuntimeError(f"Failed to poll responses: {response.status_code}")

            body = response.json()
            responses = body.get("responses", [])
            for r in responses:
                if r.get("messageId") == message_id:
                    return r.get("value")

        await asyncio.sleep(interval_s)

    raise RuntimeError("Timed out waiting for response")
