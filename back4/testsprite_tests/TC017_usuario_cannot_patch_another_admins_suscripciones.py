import requests

BASE_URL = "http://localhost:3000"
LOGIN_URL = f"{BASE_URL}/api/v1/auth/login"
USUARIOS_URL = f"{BASE_URL}/api/v1/usuarios"
TIMEOUT = 30

def test_usuario_cannot_patch_another_admin_suscripciones():
    # Login as admin_smartclarity user (logged in user)
    login_payload = {
        "email": "test.smarclarity@gmail.com",
        "password": "123123123"
    }
    login_resp = requests.post(LOGIN_URL, json=login_payload, timeout=TIMEOUT)
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    login_data = login_resp.json()
    token = login_data.get("access_token")
    assert token, "No access_token returned on login"

    logged_in_usuario = login_data.get("usuario")
    assert logged_in_usuario, "No usuario data returned on login"
    logged_in_id = logged_in_usuario.get("id")
    assert logged_in_id, "No id in usuario data"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Login as super_admin user to get super_admin id (target admin)
    superadmin_login_payload = {
        "email": "superadmin@eclariti.local",
        "password": "Demo1234!"
    }
    superadmin_login_resp = requests.post(LOGIN_URL, json=superadmin_login_payload, timeout=TIMEOUT)
    assert superadmin_login_resp.status_code == 200, f"Superadmin login failed: {superadmin_login_resp.text}"
    superadmin_data = superadmin_login_resp.json().get("usuario")
    assert superadmin_data, "No usuario data in superadmin login"
    superadmin_id = superadmin_data.get("id")
    assert superadmin_id, "No id in superadmin usuario data"

    patch_body = {"notificar_todas_empresas": True}

    # 2. Attempt PATCH on another admin's suscripciones (should be 403 Forbidden)
    patch_url_other = f"{USUARIOS_URL}/{superadmin_id}/suscripciones"
    patch_resp_other = requests.patch(patch_url_other, json=patch_body, headers=headers, timeout=TIMEOUT)
    assert patch_resp_other.status_code == 403, f"Expected 403 Forbidden when patching other admin, got {patch_resp_other.status_code}, response: {patch_resp_other.text}"

    # 3. PATCH own suscripciones, expect 200 OK and value updated
    # First GET own suscripciones value to restore later if needed
    get_own_url = f"{USUARIOS_URL}/{logged_in_id}"
    get_resp = requests.get(get_own_url, headers=headers, timeout=TIMEOUT)
    assert get_resp.status_code == 200, f"Failed to get own usuario data: {get_resp.text}"
    usuario_data_before = get_resp.json()
    original_value = usuario_data_before.get("notificar_todas_empresas")

    patch_url_own = f"{USUARIOS_URL}/{logged_in_id}/suscripciones"
    patch_resp_own = requests.patch(patch_url_own, json=patch_body, headers=headers, timeout=TIMEOUT)
    assert patch_resp_own.status_code == 200, f"Failed to patch own suscripciones: {patch_resp_own.text}"
    patch_resp_json = patch_resp_own.json()
    updated_value = patch_resp_json.get("notificar_todas_empresas")
    assert updated_value is True, f"Expected notificar_todas_empresas to be True after patch, got {updated_value}"

    # 4. GET own usuario to confirm persisted value
    get_resp_after = requests.get(get_own_url, headers=headers, timeout=TIMEOUT)
    assert get_resp_after.status_code == 200, f"Failed to get own usuario data after patch: {get_resp_after.text}"
    usuario_data_after = get_resp_after.json()
    persisted_value = usuario_data_after.get("notificar_todas_empresas")
    assert persisted_value is True, f"Expected notificar_todas_empresas persisted as True, got {persisted_value}"

    # 5. Restore original value if different
    if original_value != True:
        restore_body = {"notificar_todas_empresas": original_value}
        restore_resp = requests.patch(patch_url_own, json=restore_body, headers=headers, timeout=TIMEOUT)
        assert restore_resp.status_code == 200, f"Failed to restore original notificar_todas_empresas value: {restore_resp.text}"

test_usuario_cannot_patch_another_admin_suscripciones()