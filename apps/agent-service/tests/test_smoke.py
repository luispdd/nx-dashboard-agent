from agent_service import main


def test_smoke() -> None:
    assert callable(main)
