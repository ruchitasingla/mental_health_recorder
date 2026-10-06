from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

VALID = {
    "age": 21, "gender": "Male", "country": "India",
    "academic_level": "Undergraduate", "most_used_platform": "Instagram",
    "purpose_of_use": "Entertainment", "avg_daily_usage_hours": 4.5,
    "daily_unlocks": 80, "study_hours": 4, "physical_activity_hours": 1,
    "sleep_hours_per_night": 7, "stress_level": "Medium",
}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_predict_returns_valid_score():
    r = client.post("/predict", json=VALID)
    assert r.status_code == 200
    score = r.json()["predicted_mental_health_score"]
    assert 0 <= score <= 10


def test_unknown_country_still_works():
    r = client.post("/predict", json={**VALID, "country": "Narnia"})
    assert r.status_code == 200


def test_rejects_age_out_of_range():
    assert client.post("/predict", json={**VALID, "age": 5}).status_code == 422


def test_rejects_bad_stress_level():
    assert client.post("/predict", json={**VALID, "stress_level": "Extreme"}).status_code == 422


def test_rejects_missing_field():
    body = {k: v for k, v in VALID.items() if k != "sleep_hours_per_night"}
    assert client.post("/predict", json=body).status_code == 422
