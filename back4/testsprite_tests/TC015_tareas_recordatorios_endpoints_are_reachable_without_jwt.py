import requests

BASE_URL = "http://localhost:3000/api/v1"
TIMEOUT = 30

# These endpoints are public but require a special CRON_SECRET header for authorization.
# Without the header, server responds 401 or 403, which is expected.
# So test should accept 200, 401 or 403 responses.
def test_tareas_recordatorios_endpoints_reachable_without_jwt():
    endpoints = [
        "/tareas/recordatorios-proyectos",
        "/tareas/recordatorios-actividades"
    ]
    for endpoint in endpoints:
        url = BASE_URL + endpoint
        try:
            response = requests.post(url, timeout=TIMEOUT)
            assert response.status_code in [200, 401, 403], f"Endpoint {endpoint} responded with unexpected status code {response.status_code}"
        except requests.RequestException as e:
            assert False, f"Request to {endpoint} failed with exception: {e}"

test_tareas_recordatorios_endpoints_reachable_without_jwt()
