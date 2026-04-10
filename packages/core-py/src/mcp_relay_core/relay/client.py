"""Relay client: passphrase generation, session creation, and polling."""

import asyncio
import base64
import json
import secrets
from dataclasses import dataclass
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
    oauth_state: dict | None = None,
) -> RelaySession:
    """Create a new relay session.

    Args:
        relay_base_url: Base URL of the relay server.
        server_name: Server identifier.
        schema: Relay config schema for the setup form.
        oauth_state: Optional OAuth 2.1 authorization state.

    Returns:
        RelaySession with session ID, keys, passphrase, and relay URL.

    Raises:
        httpx.HTTPStatusError: If server returns non-2xx.
    """
    session_id = secrets.token_hex(32)
    private_key, public_key = generate_key_pair()
    passphrase = generate_passphrase()

    json_body = {
        "sessionId": session_id,
        "serverName": server_name,
        "schema": dict(schema),
    }
    if oauth_state:
        json_body["oauthState"] = oauth_state

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{relay_base_url}/api/sessions",
            json=json_body,
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
) -> dict:
    """Poll for the result of the relay session.

    Args:
        relay_base_url: Base URL of the relay server.
        session: Active RelaySession.
        interval_s: Polling interval in seconds.
        timeout_s: Maximum time to poll.

    Returns:
        Decrypted credentials dictionary.

    Raises:
        asyncio.TimeoutError: If timeout reached.
        RuntimeError: If session fails or returns unexpected data.
    """
    deadline = asyncio.get_running_loop().time() + timeout_s

    async with httpx.AsyncClient() as client:
        while asyncio.get_running_loop().time() < deadline:
            response = await client.get(
                f"{relay_base_url}/api/sessions/{session.session_id}"
            )

            if response.status_code == 200:
                body = response.json()
                if body.get("status") == "skipped":
                    # Cleanup session
                    await client.delete(
                        f"{relay_base_url}/api/sessions/{session.session_id}"
                    )
                    raise RuntimeError("RELAY_SKIPPED")

                result = body.get("result", body)
                browser_pub_b64 = result["browserPub"]
                ciphertext_b64 = result["ciphertext"]
                iv_b64 = result["iv"]
                tag_b64 = result["tag"]

                browser_key = import_public_key(browser_pub_b64)
                shared_secret = derive_shared_secret(session.private_key, browser_key)
                aes_key = derive_aes_key(shared_secret, session.passphrase)

                plaintext = decrypt(
                    aes_key,
                    base64.b64decode(ciphertext_b64),
                    base64.b64decode(iv_b64),
                    base64.b64decode(tag_b64),
                )
                return json.loads(plaintext)

            if response.status_code == 404:
                raise RuntimeError("Session expired or not found")
            if response.status_code != 202:
                raise RuntimeError(f"Unexpected status: {response.status_code}")

            await asyncio.sleep(interval_s)

    raise TimeoutError("Relay setup timed out")


async def send_message(
    relay_base_url: str,
    session_id: str,
    message: dict,
) -> str:
    """Send a message to the browser via relay.

    Args:
        relay_base_url: Base URL of the relay server.
        session_id: Active session ID.
        message: Dictionary with 'type', 'text', and optional 'data'.

    Returns:
        Message ID.
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{relay_base_url}/api/sessions/{session_id}/messages",
            json=message,
        )
        if response.status_code >= 400:
            msg = f"Failed to send message: {response.status_code}"
            raise RuntimeError(msg)
        return response.json()["id"]


async def poll_for_responses(
    relay_base_url: str,
    session_id: str,
    message_id: str,
    interval_s: float = 2.0,
    timeout_s: float = 300.0,
) -> str:
    """Poll for a specific message response.

    Args:
        relay_base_url: Base URL of the relay server.
        session_id: Active session ID.
        message_id: ID of the message to wait for.
        interval_s: Polling interval in seconds.
        timeout_s: Maximum time to poll.

    Returns:
        Response value string.
    """
    deadline = asyncio.get_running_loop().time() + timeout_s

    async with httpx.AsyncClient() as client:
        while asyncio.get_running_loop().time() < deadline:
            response = await client.get(
                f"{relay_base_url}/api/sessions/{session_id}/responses"
            )
            if response.status_code == 200:
                body = response.json()
                responses = body.get("responses", [])
                for r in responses:
                    if r.get("messageId") == message_id:
                        return r.get("value")

            await asyncio.sleep(interval_s)

    raise TimeoutError("Timed out waiting for response")
