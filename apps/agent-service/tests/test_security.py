import pytest
from cryptography.exceptions import InvalidTag

from agent_service.security import (
    ENCRYPTION_PREFIX,
    decrypt_secret,
    encrypt_secret,
)


def test_roundtrip_encryption_decryption(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CONFIG_ENCRYPTION_KEY", "test-encryption-key-for-unit-tests")
    original = "sk-proj-super-secret-api-key-12345"
    encrypted = encrypt_secret(original)

    assert encrypted.startswith(ENCRYPTION_PREFIX)
    parts = encrypted[len(ENCRYPTION_PREFIX) :].split(":")
    assert len(parts) == 3
    # Nonce is 12 bytes = 24 hex characters
    assert len(parts[0]) == 24
    # Tag is 16 bytes = 32 hex characters
    assert len(parts[1]) == 32

    decrypted = decrypt_secret(encrypted)
    assert decrypted == original


def test_missing_encryption_key_raises_runtime_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CONFIG_ENCRYPTION_KEY", raising=False)
    monkeypatch.delenv("ALLOW_INSECURE_DEV_KEY", raising=False)

    with pytest.raises(RuntimeError, match="CONFIG_ENCRYPTION_KEY is not configured"):
        encrypt_secret("some-secret")


def test_insecure_dev_key_fallback_with_warning(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.delenv("CONFIG_ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("ALLOW_INSECURE_DEV_KEY", "true")

    with caplog.at_level("WARNING"):
        encrypted = encrypt_secret("some-secret")
        decrypted = decrypt_secret(encrypted)

    assert decrypted == "some-secret"
    assert "Using insecure development key for CONFIG_ENCRYPTION_KEY" in caplog.text


def test_custom_secret_key() -> None:
    original = "custom-key-payload"
    secret = "my-custom-production-salt-key"
    encrypted = encrypt_secret(original, secret=secret)
    decrypted = decrypt_secret(encrypted, secret=secret)
    assert decrypted == original

    # Attempting to decrypt with different key should fail authentication
    with pytest.raises(InvalidTag):
        decrypt_secret(encrypted, secret="wrong-secret-key")


def test_empty_string_handling() -> None:
    assert encrypt_secret("") == ""
    assert decrypt_secret("") == ""


def test_plain_text_passthrough() -> None:
    plain = "sk-not-encrypted-plain-key"
    assert decrypt_secret(plain) == plain


def test_malformed_encrypted_string() -> None:
    malformed = f"{ENCRYPTION_PREFIX}invalid:payload"
    with pytest.raises(ValueError, match="Malformed encrypted secret format"):
        decrypt_secret(malformed)
