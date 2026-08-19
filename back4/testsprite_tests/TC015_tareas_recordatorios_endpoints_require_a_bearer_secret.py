import requests

BASE_URL = "http://localhost:3000/api/v1"
TIMEOUT = 30

def test_tareas_recordatorios_endpoints_require_bearer_secret():
    endpoints = [
        "/tareas/recordatorios-proyectos",
        "/tareas/recordatorios-actividades"
    ]

    # Test without Authorization header
    for endpoint in endpoints:
        url = BASE_URL + endpoint
        try:
            resp = requests.post(url, timeout=TIMEOUT)
            assert resp.status_code == 401, f"Expected 401 Unauthorized without auth header for {endpoint}, got {resp.status_code}"
        except requests.RequestException as e:
            assert False, f"Request to {endpoint} failed without auth header: {str(e)}"

    # Test with wrong Authorization header
    headers_wrong_auth = {
        "Authorization": "Bearer wrong-secret-12345"
    }
    for endpoint in endpoints:
        url = BASE_URL + endpoint
        try:
            resp = requests.post(url, headers=headers_wrong_auth, timeout=TIMEOUT)
            assert resp.status_code == 401, f"Expected 401 Unauthorized with wrong bearer token for {endpoint}, got {resp.status_code}"
        except requests.RequestException as e:
            assert False, f"Request to {endpoint} failed with wrong bearer token: {str(e)}"

test_tareas_recordatorios_endpoints_require_bearer_secret()