import requests

def test_post_api_v1_auth_login_valid_credentials():
    base_url = "http://localhost:3000/api/v1"
    url = f"{base_url}/auth/login"
    payload = {
        "email": "jose.perez@agrosur.cl",
        "password": "Demo1234!"
    }
    headers = {
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert "access_token" in data, "Response JSON missing 'access_token'"
    assert isinstance(data["access_token"], str) and data["access_token"].strip(), "'access_token' should be a non-empty string"

    assert "usuario" in data, "Response JSON missing 'usuario'"
    usuario = data["usuario"]
    required_keys = ["id", "nombre", "email", "rol", "cliente_id", "debe_cambiar_password"]
    for key in required_keys:
        assert key in usuario, f"'usuario' object missing '{key}' field"

    assert isinstance(usuario["id"], str) and usuario["id"].strip(), "'id' should be a non-empty string"
    assert isinstance(usuario["nombre"], str), "'nombre' should be a string"
    assert usuario["email"] == payload["email"], f"'email' in usuario should be '{payload['email']}'"
    assert isinstance(usuario["rol"], str) and usuario["rol"].strip(), "'rol' should be a non-empty string"
    # cliente_id can be string or null
    assert (usuario["cliente_id"] is None) or (isinstance(usuario["cliente_id"], str)), "'cliente_id' should be string or null"
    assert isinstance(usuario["debe_cambiar_password"], bool), "'debe_cambiar_password' should be a boolean"

test_post_api_v1_auth_login_valid_credentials()