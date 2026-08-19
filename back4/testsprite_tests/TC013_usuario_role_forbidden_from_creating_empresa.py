import requests

BASE_URL = "http://localhost:3000/api/v1"
TIMEOUT = 30

def test_usuario_role_forbidden_from_creating_empresa():
    # Credentials for usuario consumidor (rol consumidor) jose.perez@agrosur.cl
    login_url = f"{BASE_URL}/auth/login"
    login_payload = {
        "email": "jose.perez@agrosur.cl",
        "password": "Demo1234!"
    }

    try:
        # 1. Login as usuario consumidor
        login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_data = login_resp.json()
        token = login_data.get("access_token")
        assert token, "No access_token received on login"
        # Assert role is usuario (consumidor)
        usuario_rol = login_data.get("usuario", {}).get("rol", "")
        assert usuario_rol == "usuario" or usuario_rol == "consumidor" or usuario_rol == "usuario consumidor" or usuario_rol == "consumidor", f"User role unexpected: {usuario_rol}"

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        # 2. Attempt to POST /api/v1/empresas with valid payload
        empresas_url = f"{BASE_URL}/empresas"
        empresa_payload = {
            "nombre": "Empresa Forbidden Test",
            "rut": "12345678-9",
            "direccion": "Calle Falsa 123",
            "telefono": "+56912345678",
            "email": "contacto@empresaforbidden.cl",
            "giro": "Test Giro"
        }
        response = requests.post(empresas_url, json=empresa_payload, headers=headers, timeout=TIMEOUT)

        # 3. Verify response is 403 Forbidden
        assert response.status_code == 403, f"Expected 403 Forbidden but got {response.status_code}, response text: {response.text}"

    except requests.RequestException as e:
        assert False, f"RequestException occurred: {e}"

test_usuario_role_forbidden_from_creating_empresa()