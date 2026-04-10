"""Client for interacting with the MCP Relay server."""

import asyncio
import base64
import json
import logging
import time
from dataclasses import dataclass
from typing import Any

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
from mcp_relay_core.schema.types import RelayConfigSchema

logger = logging.getLogger(__name__)


@dataclass
class RelaySession:
    """Active relay session state."""

    session_id: str
    private_key: EllipticCurvePrivateKey
    public_key: EllipticCurvePublicKey | None
    passphrase: str
    relay_url: str


def generate_passphrase(word_count: int = 4) -> str:
    """Generate a random passphrase using the Diceware wordlist.

    Args:
        word_count: Number of words to include in the passphrase.

    Returns:
        A hyphen-separated string of words.
    """
    import secrets

    from mcp_relay_core.relay.wordlist import WORDLIST

    words = [secrets.choice(WORDLIST) for _ in range(word_count)]
    return "-".join(words)


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
        oauth_state: Optional OAuth state to include in the session.
    """
    session_id = secrets_hex(32)
    private_key, public_key = generate_key_pair()
    passphrase = generate_passphrase()

    payload: dict[str, Any] = {
        "sessionId": session_id,
        "serverName": server_name,
        "schema": schema,
    }
    if oauth_state:
        payload["oauthState"] = oauth_state

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{relay_base_url}/api/sessions",
            json=payload,
        )
        if response.status_code != 201:
            msg = f"Relay session creation failed: {response.status_code}"
            raise RuntimeError(msg)

    pub_key_b64 = export_public_key(public_key)
    # Note: Fragments (#) are not sent to the server, perfect for the keys
    relay_url = f"{relay_base_url}/setup?s={session_id}#k={pub_key_b64}&p={passphrase}"

    return RelaySession(
        session_id=session_id,
        private_key=private_key,
        public_key=public_key,
        passphrase=passphrase,
        relay_url=relay_url,
    )


def secrets_hex(nbytes: int) -> str:
    import secrets

    return secrets.token_hex(nbytes)


async def poll_for_result(
    relay_base_url: str,
    session: RelaySession,
    interval_s: float = 2.0,
    timeout_s: float = 600.0,
) -> dict[str, str]:
    """Poll the relay server for the setup result.

    Args:
        relay_base_url: Base URL of the relay server.
        session: Active relay session.
        interval_s: Polling interval in seconds.
        timeout_s: Maximum time to poll in seconds.

    Returns:
        The decrypted configuration result.
    """
    deadline = time.time() + timeout_s

    async with httpx.AsyncClient() as client:
        while time.time() < deadline:
            response = await client.get(
                f"{relay_base_url}/api/sessions/{session.session_id}"
            )
            if response.status_code == 200:
                body = response.json()

                if body.get("status") == "skipped":
                    # Cleanup session
                    try:
                        await client.delete(
                            f"{relay_base_url}/api/sessions/{session.session_id}"
                        )
                    except Exception:
                        pass
                    raise RuntimeError("RELAY_SKIPPED")

                result_data = body.get("result", body)
                browser_pub_b64 = result_data["browserPub"]
                ciphertext_b64 = result_data["ciphertext"]
                iv_b64 = result_data["iv"]
                tag_b64 = result_data["tag"]

                browser_pub = import_public_key(browser_pub_b64)
                shared_secret = derive_shared_secret(session.private_key, browser_pub)
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
                msg = f"Unexpected status: {response.status_code}"
                raise RuntimeError(msg)

            await asyncio.sleep(interval_s)

    raise RuntimeError("Relay setup timed out")


async def send_message(
    relay_base_url: str,
    session_id: str,
    message: dict[str, Any],
) -> str:
    """Send a message to a session."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{relay_base_url}/api/sessions/{session_id}/messages",
            json=message,
        )
        if response.status_code != 200:
            msg = f"Failed to send message: {response.status_code}"
            raise RuntimeError(msg)
        body = response.json()
        return body["id"]


async def poll_for_responses(
    relay_base_url: str,
    session_id: str,
    message_id: str,
    interval_s: float = 2.0,
    timeout_s: float = 300.0,
) -> str:
    """Poll for responses to a message."""
    deadline = time.time() + timeout_s

    async with httpx.AsyncClient() as client:
        while time.time() < deadline:
            response = await client.get(
                f"{relay_base_url}/api/sessions/{session_id}/responses"
            )
            if response.status_code != 200:
                msg = f"Failed to poll responses: {response.status_code}"
                raise RuntimeError(msg)

            body = response.json()
            responses = body.get("responses", [])
            for r in responses:
                if r.get("messageId") == message_id:
                    return r["value"]

            await asyncio.sleep(interval_s)

    raise RuntimeError("Timed out waiting for response")
