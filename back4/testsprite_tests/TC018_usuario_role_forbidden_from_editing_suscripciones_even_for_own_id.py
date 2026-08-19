import requests

BASE_URL = "http://localhost:3000"
LOGIN_URL = f"{BASE_URL}/api/v1/auth/login"
SUSCRIPCIONES_PATH = "/api/v1/usuarios/{id}/suscripciones"

USER_EMAIL = "jose.perez@agrosur.cl"
USER_PASSWORD = "Demo1234!"
TIMEOUT = 30


def test_usuario_role_forbidden_editing_own_suscripciones():
    # Login as usuario role (consumidor)
    login_payload = {
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    }

    try:
        login_resp = requests.post(LOGIN_URL, json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_data = login_resp.json()
        access_token = login_data.get("access_token")
        assert access_token, "No access_token returned on login"
        user = login_data.get("usuario")
        assert user, "No usuario data returned on login"
        user_id = user.get("id")
        assert user_id, "No user id returned in usuario data"
    except Exception as e:
        raise AssertionError(f"Login request failed: {e}")

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    patch_url = f"{BASE_URL}" + SUSCRIPCIONES_PATH.format(id=user_id)
    patch_body = {
        "notificar_todas_empresas": True
    }

    try:
        patch_resp = requests.patch(patch_url, json=patch_body, headers=headers, timeout=TIMEOUT)
    except Exception as e:
        raise AssertionError(f"PATCH request to suscripciones failed: {e}")

    # Validate that the response is 403 Forbidden
    assert patch_resp.status_code == 403, \
        f"Expected 403 Forbidden but got {patch_resp.status_code}, response text: {patch_resp.text}"


test_usuario_role_forbidden_editing_own_suscripciones()