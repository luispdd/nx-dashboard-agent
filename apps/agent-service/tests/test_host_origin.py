import pytest
from fastapi.testclient import TestClient

from agent_service.config import Settings
from agent_service.main import create_app


@pytest.fixture
def client() -> TestClient:
    cfg = Settings(
        allowed_origins="http://localhost:4200,http://127.0.0.1:4200",
        allowed_hosts="localhost,127.0.0.1,testserver,localhost:8000,127.0.0.1:8000",
    )
    app = create_app(custom_settings=cfg)
    return TestClient(app)


def test_allowed_origin_and_host(client: TestClient) -> None:
    res = client.get(
        "/health",
        headers={
            "host": "localhost:8000",
            "origin": "http://localhost:4200",
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert res.headers.get("access-control-allow-origin") == "http://localhost:4200"


def test_missing_origin_allowed(client: TestClient) -> None:
    # Server-to-server or curl requests have no origin header
    res = client.get("/health", headers={"host": "127.0.0.1:8000"})
    assert res.status_code == 200


def test_foreign_origin_rejected(client: TestClient) -> None:
    res = client.get(
        "/health",
        headers={
            "host": "localhost:8000",
            "origin": "http://attacker.example.com",
        },
    )
    assert res.status_code == 403
    assert "Origin 'http://attacker.example.com' is not allowed" in res.json()["detail"]


def test_unrecognized_host_rejected(client: TestClient) -> None:
    # Protects against DNS rebinding
    res = client.get(
        "/health",
        headers={
            "host": "evil-rebind.attacker.com",
            "origin": "http://localhost:4200",
        },
    )
    assert res.status_code == 403
    assert "Host 'evil-rebind.attacker.com' is not allowed" in res.json()["detail"]
