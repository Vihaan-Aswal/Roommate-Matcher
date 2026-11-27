"""Real asymmetric signing round-trips under the cryptography 50 runtime."""
from __future__ import annotations

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa


def _pem_pair(key) -> tuple[bytes, bytes]:
    private = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    public = key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private, public


def test_pyjwt_rs256_round_trip() -> None:
    private, public = _pem_pair(rsa.generate_private_key(public_exponent=65537, key_size=2048))

    token = jwt.encode({"sub": "rs256-test"}, private, algorithm="RS256")

    assert jwt.decode(token, public, algorithms=["RS256"])["sub"] == "rs256-test"


def test_pyjwt_es256_round_trip() -> None:
    private, public = _pem_pair(ec.generate_private_key(ec.SECP256R1()))

    token = jwt.encode({"sub": "es256-test"}, private, algorithm="ES256")

    assert jwt.decode(token, public, algorithms=["ES256"])["sub"] == "es256-test"
