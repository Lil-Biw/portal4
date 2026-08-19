import requests

BASE_URL = "http://localhost:3000/api/v1"
TIMEOUT = 30

def test_post_api_v1_auth_login_invalid_credentials():
    login_url = f"{BASE_URL}/auth/login"
    headers = {"Content-Type": "application/json"}

    test_cases = [
        {"email": "jose.perez@agrosur.cl", "password": "WrongPassword123!"},
        {"email": "nonexistentuser@example.com", "password": "AnyPassword123!"}
    ]

    for credentials in test_cases:
        try:
            response = requests.post(login_url, json=credentials, headers=headers, timeout=TIMEOUT)
        except requests.RequestException as e:
            assert False, f"HTTP request failed: {e}"

        assert response.status_code == 401, (
            f"Expected 401 Unauthorized for credentials {credentials}, got {response.status_code}"
        )

        try:
            resp_json = response.json()
        except ValueError:
            resp_json = {}

        # The response_schema for 401 does not provide an access_token, so assert none
        assert "access_token" not in resp_json, (
            f"Access token should not be present for invalid credentials {credentials}"
        )

test_post_api_v1_auth_login_invalid_credentials()