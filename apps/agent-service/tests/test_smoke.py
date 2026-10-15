from agent_service.main import app, main


def test_smoke() -> None:
    assert callable(main)
    assert app is not None
