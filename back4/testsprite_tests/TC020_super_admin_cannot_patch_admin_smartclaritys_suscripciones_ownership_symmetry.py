import requests
from requests.auth import HTTPBasicAuth

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

SUPER_ADMIN_EMAIL = "superadmin@eclariti.local"
SUPER_ADMIN_PASSWORD = "Demo1234!"
ADMIN_SMARTCLARITY_ALTERNATIVE_EMAIL = "carla.munoz@mineraandina.cl"
ADMIN_SMARTCLARITY_ALTERNATIVE_PASSWORD = "Demo1234!"

def login(email, password):
    url = f"{BASE_URL}/api/v1/auth/login"
    resp = requests.post(url, json={"email": email, "password": password}, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    token = data.get("access_token")
    user_id = data.get("usuario", {}).get("id")
    return token, user_id

def get_suscripciones(token, user_id):
    url = f"{BASE_URL}/api/v1/usuarios/{user_id}"
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(url, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json().get("suscripciones", {})

def patch_suscripciones(token, user_id, body):
    url = f"{BASE_URL}/api/v1/usuarios/{user_id}/suscripciones"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    resp = requests.patch(url, headers=headers, json=body, timeout=TIMEOUT)
    return resp

def test_tc020_super_admin_cannot_patch_other_admin_suscripciones():
    # Login as super_admin
    super_token, super_user_id = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    # Login as another admin_smartclarity user
    alt_token, alt_user_id = login(ADMIN_SMARTCLARITY_ALTERNATIVE_EMAIL, ADMIN_SMARTCLARITY_ALTERNATIVE_PASSWORD)

    # 1) Attempt PATCH on the other admin_smartclarity user's suscripciones as super_admin -> expect 403
    patch_body = {"notificar_todas_empresas": True}
    resp_forbidden = patch_suscripciones(super_token, alt_user_id, patch_body)
    assert resp_forbidden.status_code == 403, f"Expected 403 Forbidden, got {resp_forbidden.status_code}, response: {resp_forbidden.text}"

    # 2) Get super_admin current suscripciones to restore later if needed
    user_url = f"{BASE_URL}/api/v1/usuarios/{super_user_id}"
    headers = {"Authorization": f"Bearer {super_token}"}
    user_resp = requests.get(user_url, headers=headers, timeout=TIMEOUT)
    user_resp.raise_for_status()
    user_data = user_resp.json()
    original_suscripciones = user_data.get("suscripciones", {})
    original_notificar = original_suscripciones.get("notificar_todas_empresas", None)

    # 3) PATCH on super_admin's own suscripciones with notificar_todas_empresas:true -> expect 200 and reflect change
    patch_body_super = {"notificar_todas_empresas": True}
    resp_ok = patch_suscripciones(super_token, super_user_id, patch_body_super)
    assert resp_ok.status_code == 200, f"Expected 200 OK on own suscripciones patch, got {resp_ok.status_code}, response: {resp_ok.text}"
    resp_json = resp_ok.json()
    # The response should reflect the updated value
    updated_notificar = resp_json.get("notificar_todas_empresas")
    assert updated_notificar is True, f"Expected notificar_todas_empresas True in response, got {updated_notificar}"

    # 4) If original_notificar differs and is boolean, restore it to original state
    try:
        if isinstance(original_notificar, bool) and original_notificar != True:
            restore_body = {"notificar_todas_empresas": original_notificar}
            restore_resp = patch_suscripciones(super_token, super_user_id, restore_body)
            assert restore_resp.status_code == 200, f"Failed to restore original notificar_todas_empresas: status {restore_resp.status_code}, response: {restore_resp.text}"
    finally:
        pass

test_tc020_super_admin_cannot_patch_other_admin_suscripciones()
