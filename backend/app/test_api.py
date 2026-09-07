"""Smoke tests: `pip install pytest && PYTHONPATH=. pytest -q`."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["shoot_days"] > 0


def test_schedule_baseline_is_shootable():
    body = client.get("/schedule").json()
    assert body["baseline_cost"] > 0
    hard = [v for v in body["violations"] if v["severity"] == "hard"]
    assert hard == [], f"starting board must be feasible, got {hard}"


def test_change_returns_ranked_plans():
    body = client.post("/change", json={"request": "move scene 5 to day 3", "use_search": False}).json()
    plans = body["plans"]
    assert len(plans) == 3
    assert [p["rank"] for p in plans] == [1, 2, 3]
    for plan in plans:
        assert plan["changes"]
        assert isinstance(plan["cost"], (int, float))
        assert plan["feasible"]


def test_hard_violations_are_rejected_not_ranked():
    body = client.post("/change", json={"request": "swap scene 4 and scene 9", "use_search": False}).json()
    assert body["status"] == "no_viable_plan"
    assert body["plans"] == []
    assert body["rejected"] and body["rejected"][0]["reasons"]


def test_unparseable_request():
    assert client.post("/change", json={"request": "make it better"}).status_code == 422


def test_unknown_scene():
    r = client.post("/change", json={"request": "move scene 99 to day 2", "use_search": False})
    assert r.status_code == 404