import hashlib
import logging
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)

DEFAULT_DEV_KEY = "nx-dashboard-agent-dev-secret-key-2026"
ENCRYPTION_PREFIX = "enc:aes256:"


def mask_secret(
    val: str | None, visible_prefix: int = 3, visible_suffix: int = 4
) -> str:
    """Mask a sensitive string, preserving only a short prefix and suffix."""
    if not val:
        return ""
    if len(val) <= visible_prefix + visible_suffix:
        return "***"
    return f"{val[:visible_prefix]}...{val[-visible_suffix:]}"


def derive_key(secret: str | None = None) -> bytes:
    key_str = secret or os.getenv("CONFIG_ENCRYPTION_KEY")
    if not key_str:
        allow_insecure = (
            os.getenv("ALLOW_INSECURE_DEV_KEY", "").strip().lower() == "true"
        )
        if allow_insecure:
            logger.warning(
                "⚠️  Security Warning: Using insecure development key for CONFIG_ENCRYPTION_KEY. "
                "Do not use in production."
            )
            key_str = DEFAULT_DEV_KEY
        else:
            raise RuntimeError(
                "CONFIG_ENCRYPTION_KEY is not configured. Set CONFIG_ENCRYPTION_KEY in .env "
                "or pass ALLOW_INSECURE_DEV_KEY=true for insecure local development."
            )

    return hashlib.sha256(key_str.encode("utf-8")).digest()


def encrypt_secret(plain_text: str, secret: str | None = None) -> str:
    """Encrypt a string using AES-256-GCM.

    Returns string formatted as enc:aes256:<nonce_hex>:<tag_hex>:<ciphertext_hex>.
    """
    if not plain_text:
        return ""

    key = derive_key(secret)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    data = plain_text.encode("utf-8")
    encrypted = aesgcm.encrypt(nonce, data, None)

    # In cryptography's AESGCM, the last 16 bytes are the auth tag
    ciphertext = encrypted[:-16]
    tag = encrypted[-16:]

    return f"{ENCRYPTION_PREFIX}{nonce.hex()}:{tag.hex()}:{ciphertext.hex()}"


def decrypt_secret(encrypted_text: str, secret: str | None = None) -> str:
    """Decrypt an encrypted string formatted as enc:aes256:<nonce_hex>:<tag_hex>:<ciphertext_hex>.

    If the text is not encrypted (does not start with enc:aes256:), returns it as-is.
    """
    if not encrypted_text:
        return ""

    if not encrypted_text.startswith(ENCRYPTION_PREFIX):
        return encrypted_text

    payload = encrypted_text[len(ENCRYPTION_PREFIX) :]
    parts = payload.split(":")
    if len(parts) != 3:
        raise ValueError(
            "Malformed encrypted secret format. Expected <nonce>:<tag>:<ciphertext>"
        )

    nonce_hex, tag_hex, ciphertext_hex = parts
    nonce = bytes.fromhex(nonce_hex)
    tag = bytes.fromhex(tag_hex)
    ciphertext = bytes.fromhex(ciphertext_hex)

    key = derive_key(secret)
    aesgcm = AESGCM(key)
    decrypted_bytes = aesgcm.decrypt(nonce, ciphertext + tag, None)
    return decrypted_bytes.decode("utf-8")
