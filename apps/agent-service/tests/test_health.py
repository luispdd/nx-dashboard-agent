import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from agent_service.config import Settings
from agent_service.main import create_app
from agent_service.session_manager import SessionManager, reset_session_manager


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    reset_session_manager()
    for var in ["LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY", "RUNTIME_CONFIG_PATH"]:
        monkeypatch.delenv(var, raising=False)
    yield
    reset_session_manager()


@pytest.fixture
def test_app() -> FastAPI:
    custom_settings = Settings(
        llm_base_url="http://127.0.0.1:8888/v1",
        llm_model="unsloth/Qwen3.5-4B-GGUF",
        llm_api_key="super-secret-key-12345",
    )
    sm = SessionManager()
    return create_app(custom_settings=custom_settings, session_manager=sm)


@pytest.fixture
def client(test_app: FastAPI) -> TestClient:
    return TestClient(test_app)


def test_health_check_endpoint(client: TestClient, test_app: FastAPI) -> None:
    sm: SessionManager = test_app.state.session_manager
    sm.get_or_create_session("sess-abc")

    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "ok"
    assert data["provider"] == "http://127.0.0.1:8888/v1"
    assert data["model"] == "unsloth/Qwen3.5-4B-GGUF"
    assert data["active_sessions"] == 1

    # Verify secret is never leaked
    assert "super-secret-key" not in response.text
    assert "api_key" not in data


@pytest.mark.asyncio
async def test_async_client_health(test_app: FastAPI) -> None:
    from httpx import ASGITransport, AsyncClient

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"


def test_cors_allowed_origins(client: TestClient) -> None:
    # Angular shell
    res1 = client.get("/health", headers={"Origin": "http://localhost:4200"})
    assert res1.status_code == 200
    assert res1.headers.get("access-control-allow-origin") == "http://localhost:4200"
    assert res1.headers.get("access-control-allow-credentials") == "true"

    # React chat MFE
    res2 = client.get("/health", headers={"Origin": "http://localhost:4204"})
    assert res2.status_code == 200
    assert res2.headers.get("access-control-allow-origin") == "http://localhost:4204"

    # Disallowed origin
    res3 = client.get("/health", headers={"Origin": "http://untrusted-site.com"})
    assert res3.status_code == 200
    assert "access-control-allow-origin" not in res3.headers


def test_cors_preflight(client: TestClient) -> None:
    headers = {
        "Origin": "http://localhost:4200",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }
    res = client.options("/health", headers=headers)
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "http://localhost:4200"
    assert "POST" in res.headers.get("access-control-allow-methods", "")


def test_lifespan_cleans_sessions() -> None:
    sm = SessionManager()
    sm.get_or_create_session("sess-to-clear")
    assert sm.active_session_count() == 1

    app = create_app(session_manager=sm)
    with TestClient(app):
        # Within the TestClient context, lifespan startup ran
        assert sm.active_session_count() == 1

    # After exiting TestClient context, lifespan shutdown ran and cleared sessions
    assert sm.active_session_count() == 0
