import requests

BASE_URL = "http://localhost:3000/api/v1"

def test_get_empresas_without_jwt_is_rejected():
    url = f"{BASE_URL}/empresas"
    headers = {
        # Intentionally no Authorization header
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"

test_get_empresas_without_jwt_is_rejected()