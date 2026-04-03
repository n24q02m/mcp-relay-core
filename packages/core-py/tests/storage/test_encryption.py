"""Tests for PBKDF2 key derivation + AES-256-GCM file encryption."""

import pytest
from cryptography.exceptions import InvalidTag

from mcp_relay_core.storage.encryption import (
    decrypt_data,
    derive_file_key,
    derive_passphrase_key,
    encrypt_data,
)


class TestDeriveFileKey:
    def test_returns_32_byte_key(self):
        key = derive_file_key("machine-123", "alice")
        assert isinstance(key, bytes)
        assert len(key) == 32

    def test_same_inputs_produce_same_key(self):
        key1 = derive_file_key("id-abc", "bob")
        key2 = derive_file_key("id-abc", "bob")

        encrypted = encrypt_data(key1, "test data")
        decrypted = decrypt_data(key2, encrypted)
        assert decrypted == "test data"

    def test_different_machine_id_produces_different_key(self):
        key1 = derive_file_key("machine-A", "user")
        key2 = derive_file_key("machine-B", "user")

        encrypted = encrypt_data(key1, "secret")
        with pytest.raises(InvalidTag):
            decrypt_data(key2, encrypted)

    def test_different_username_produces_different_key(self):
        key1 = derive_file_key("machine-1", "alice")
        key2 = derive_file_key("machine-1", "bob")

        encrypted = encrypt_data(key1, "secret")
        with pytest.raises(InvalidTag):
            decrypt_data(key2, encrypted)


class TestDerivePassphraseKey:
    def test_returns_32_byte_key(self):
        key = derive_passphrase_key("my secret passphrase")
        assert isinstance(key, bytes)
        assert len(key) == 32

    def test_same_passphrase_produces_same_key(self):
        passphrase = "password123"
        key1 = derive_passphrase_key(passphrase)
        key2 = derive_passphrase_key(passphrase)
        assert key1 == key2

    def test_different_passphrase_produces_different_key(self):
        key1 = derive_passphrase_key("passphrase-A")
        key2 = derive_passphrase_key("passphrase-B")

        encrypted = encrypt_data(key1, "top secret")
        with pytest.raises(InvalidTag):
            decrypt_data(key2, encrypted)

    def test_known_value(self):
        # Result of: hashlib.pbkdf2_hmac("sha256", b"correct-horse-battery-staple", b"mcp-relay-export", 100000, 32)
        expected = "2949ffe06e806958227246408857c3280ef7f73db34603184267bdb7a38ebe9e"
        key = derive_passphrase_key("correct-horse-battery-staple")
        assert key.hex() == expected


class TestEncryptDecryptRoundtrip:
    def test_encrypts_and_decrypts_plain_text(self):
        key = derive_file_key("test-machine", "test-user")
        plaintext = "hello, config!"

        encrypted = encrypt_data(key, plaintext)
        assert isinstance(encrypted, bytes)
        assert len(encrypted) > 12  # IV + ciphertext

        decrypted = decrypt_data(key, encrypted)
        assert decrypted == plaintext

    def test_handles_empty_string(self):
        key = derive_file_key("m", "u")
        encrypted = encrypt_data(key, "")
        decrypted = decrypt_data(key, encrypted)
        assert decrypted == ""

    def test_handles_unicode_text(self):
        key = derive_file_key("m", "u")
        text = "Xin chao the gioi! Tieng Viet co dau"
        encrypted = encrypt_data(key, text)
        decrypted = decrypt_data(key, encrypted)
        assert decrypted == text

    def test_produces_different_ciphertext_each_time(self):
        key = derive_file_key("m", "u")
        enc1 = encrypt_data(key, "same")
        enc2 = encrypt_data(key, "same")
        assert enc1 != enc2

    def test_wrong_key_fails_to_decrypt(self):
        key1 = derive_file_key("m1", "u1")
        key2 = derive_file_key("m2", "u2")

        encrypted = encrypt_data(key1, "secret data")
        with pytest.raises(InvalidTag):
            decrypt_data(key2, encrypted)
