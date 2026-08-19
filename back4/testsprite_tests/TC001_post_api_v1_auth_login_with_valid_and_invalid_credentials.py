import requests

BASE_URL = "http://localhost:3000/api/v1"
TIMEOUT = 30

def test_post_api_v1_auth_login_with_valid_and_invalid_credentials():
    url = f"{BASE_URL}/auth/login"
    headers = {"Content-Type": "application/json"}

    # Valid credentials
    valid_payload = {
        "email": "superadmin@eclariti.local",
        "password": "Demo1234!"
    }

    try:
        valid_response = requests.post(url, json=valid_payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Valid login request failed: {e}"

    # Assertions for valid response
    assert valid_response.status_code == 200, f"Expected 200 for valid login, got {valid_response.status_code}"
    try:
        valid_data = valid_response.json()
    except ValueError:
        assert False, "Valid login response is not valid JSON"
    assert "access_token" in valid_data, "Valid login response missing 'access_token'"
    assert isinstance(valid_data["access_token"], str) and valid_data["access_token"], "'access_token' should be a non-empty string"
    assert "usuario" in valid_data, "Valid login response missing 'usuario' data"
    usuario = valid_data["usuario"]
    assert isinstance(usuario, dict), "'usuario' should be a dict"
    required_usuario_fields = ["id", "nombre", "email", "rol", "cliente_id", "debe_cambiar_password"]
    for field in required_usuario_fields:
        assert field in usuario, f"'usuario' missing field '{field}'"
    assert usuario["email"] == valid_payload["email"], "Usuario email does not match login email"
    assert usuario["rol"] in ["super_admin", "admin_smartclarity", "usuario"], "'rol' field has unexpected value"
    assert isinstance(usuario["debe_cambiar_password"], bool), "'debe_cambiar_password' should be boolean"

    # Invalid credentials tests
    invalid_credentials_list = [
        {"email": "superadmin@eclariti.local", "password": "WrongPassword123!"},
        {"email": "nonexistent@eclariti.local", "password": "AnyPassword!"}
    ]

    for invalid_payload in invalid_credentials_list:
        try:
            invalid_response = requests.post(url, json=invalid_payload, headers=headers, timeout=TIMEOUT)
        except requests.RequestException as e:
            assert False, f"Invalid login request failed: {e}"

        assert invalid_response.status_code == 401, (
            f"Expected 401 for invalid login with payload {invalid_payload}, got {invalid_response.status_code}"
        )
        try:
            invalid_data = invalid_response.json()
        except ValueError:
            # Backend may not return JSON on 401; still accept as valid error case
            continue
        # The response body/message may vary; no strict assertion here as per PRD
        # Just check presence of error message or string
        assert isinstance(invalid_data, (dict, str)), "Invalid login response should be JSON or text"

test_post_api_v1_auth_login_with_valid_and_invalid_credentials()