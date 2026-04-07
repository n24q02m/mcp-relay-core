"""Cross-language crypto test vectors -- THE MOST IMPORTANT TEST.

Verifies that Python crypto produces identical output to the TypeScript
implementation for the same inputs.
"""

import json
from pathlib import Path

from mcp_relay_core.crypto.aes import decrypt
from mcp_relay_core.crypto.kdf import derive_aes_key
from mcp_relay_core.storage.encryption import derive_file_key, derive_passphrase_key

VECTORS_PATH = Path(__file__).parent.parent / "fixtures" / "crypto-vectors.json"


def _load_vectors() -> dict:
    return json.loads(VECTORS_PATH.read_text())


class TestHKDFVectors:
    def test_derives_expected_key(self):
        vectors = _load_vectors()
        hkdf = vectors["hkdf"]

        shared_secret = bytes.fromhex(hkdf["shared_secret_hex"])
        derived = derive_aes_key(shared_secret, hkdf["passphrase"])

        assert derived.hex() == hkdf["derived_key_hex"]


class TestAESGCMVectors:
    def test_encrypts_to_expected_ciphertext_with_fixed_iv(self):
        """Verify encryption matches vectors using fixed IV (test only)."""
        vectors = _load_vectors()
        hkdf = vectors["hkdf"]
        aes = vectors["aes_gcm"]

        shared_secret = bytes.fromhex(hkdf["shared_secret_hex"])
        key = derive_aes_key(shared_secret, hkdf["passphrase"])

        iv = bytes.fromhex(aes["iv_hex"])
        plaintext = aes["plaintext"].encode("utf-8")

        # Use AESGCM directly with fixed IV for vector testing
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        aesgcm = AESGCM(key)
        combined = aesgcm.encrypt(iv, plaintext, None)
        ciphertext = combined[:-16]
        tag = combined[-16:]

        assert ciphertext.hex() == aes["ciphertext_hex"]
        assert tag.hex() == aes["tag_hex"]

    def test_decrypts_vector_ciphertext_to_expected_plaintext(self):
        vectors = _load_vectors()
        hkdf = vectors["hkdf"]
        aes = vectors["aes_gcm"]

        shared_secret = bytes.fromhex(hkdf["shared_secret_hex"])
        key = derive_aes_key(shared_secret, hkdf["passphrase"])

        ciphertext = bytes.fromhex(aes["ciphertext_hex"])
        iv = bytes.fromhex(aes["iv_hex"])
        tag = bytes.fromhex(aes["tag_hex"])

        plaintext = decrypt(key, ciphertext, iv, tag)
        assert plaintext == aes["plaintext"]


class TestPBKDF2Vectors:
    def test_config_keys_match_vectors(self):
        vectors = _load_vectors()["pbkdf2"]["config"]
        material = vectors["material"]
        parts = material.split(":")
        machine_id, username = parts[0], parts[1]

        assert (
            derive_file_key(machine_id, username, 1000000).hex()
            == vectors["iterations_1M"]
        )
        assert (
            derive_file_key(machine_id, username, 600000).hex()
            == vectors["iterations_600k"]
        )
        assert (
            derive_file_key(machine_id, username, 100000).hex()
            == vectors["iterations_100k"]
        )

    def test_export_keys_match_vectors(self):
        vectors = _load_vectors()["pbkdf2"]["export"]
        passphrase = vectors["passphrase"]

        assert (
            derive_passphrase_key(passphrase, 1000000).hex() == vectors["iterations_1M"]
        )
        assert (
            derive_passphrase_key(passphrase, 600000).hex()
            == vectors["iterations_600k"]
        )
        assert (
            derive_passphrase_key(passphrase, 100000).hex()
            == vectors["iterations_100k"]
        )
