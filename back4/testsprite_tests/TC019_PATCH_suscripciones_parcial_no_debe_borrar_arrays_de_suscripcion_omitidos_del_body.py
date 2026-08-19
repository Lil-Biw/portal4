import requests

BASE_URL = "http://localhost:3000"
LOGIN_URL = f"{BASE_URL}/api/v1/auth/login"
USUARIO_SUSCRIPCIONES_URL = f"{BASE_URL}/api/v1/usuarios"
TIMEOUT = 30

EMAIL = "test.smarclarity@gmail.com"
PASSWORD = "123123123"
EMPRESA_ID = "88470ce18ae82b1e2b1d6704"
CENTRO_ID = "2fd21de12e0d09df599db5c2"


def test_patch_suscripciones_partial_no_borra_arrays_omitidos():
    # Login and get token and user id
    auth_response = requests.post(
        LOGIN_URL,
        json={"email": EMAIL, "password": PASSWORD},
        timeout=TIMEOUT,
    )
    assert auth_response.status_code == 200, f"Login failed: {auth_response.text}"
    auth_data = auth_response.json()
    access_token = auth_data.get("access_token")
    user = auth_data.get("usuario")
    assert access_token, "No access_token in login response"
    assert user and "id" in user, "No usuario id in login response"
    user_id = user["id"]

    headers = {"Authorization": f"Bearer {access_token}"}

    # GET current suscripciones to save original state for restoration
    get_user_resp = requests.get(
        f"{USUARIO_SUSCRIPCIONES_URL}/{user_id}", headers=headers, timeout=TIMEOUT
    )
    assert get_user_resp.status_code == 200, f"Failed to GET user: {get_user_resp.text}"
    original_data = get_user_resp.json()
    original_notificar_todas_empresas = original_data.get("notificar_todas_empresas", True)
    original_empresas_suscritas = original_data.get("empresas_suscritas", [])
    original_centros_suscritos = original_data.get("centros_suscritos", [])
    original_proyectos_suscritos = original_data.get("proyectos_suscritos", [])

    try:
        # Step 1: PATCH with notificar_todas_empresas: false, empresas_suscritas: [EMPRESA_ID]
        patch_body_1 = {
            "notificar_todas_empresas": False,
            "empresas_suscritas": [EMPRESA_ID],
        }
        patch_resp_1 = requests.patch(
            f"{USUARIO_SUSCRIPCIONES_URL}/{user_id}/suscripciones",
            json=patch_body_1,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert patch_resp_1.status_code == 200, f"PATCH step 1 failed: {patch_resp_1.text}"
        patch_1_resp_json = patch_resp_1.json()
        # empresas_suscritas must reflect the array with EMPRESA_ID
        assert "empresas_suscritas" in patch_1_resp_json, "empresas_suscritas missing in response step 1"
        assert patch_1_resp_json["empresas_suscritas"] == [EMPRESA_ID], "empresas_suscritas not updated to expected value in step 1"

        # Step 2: PATCH with notificar_todas_empresas: false, centros_suscritos: [CENTRO_ID]
        # empresas_suscritas omitted intentionally to verify partial patch
        patch_body_2 = {
            "notificar_todas_empresas": False,
            "centros_suscritos": [CENTRO_ID],
        }
        patch_resp_2 = requests.patch(
            f"{USUARIO_SUSCRIPCIONES_URL}/{user_id}/suscripciones",
            json=patch_body_2,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert patch_resp_2.status_code == 200, f"PATCH step 2 failed: {patch_resp_2.text}"
        patch_2_resp_json = patch_resp_2.json()
        # empresas_suscritas still must contain EMPRESA_ID (not wiped)
        assert "empresas_suscritas" in patch_2_resp_json, "empresas_suscritas missing in response step 2"
        assert patch_2_resp_json["empresas_suscritas"] == [EMPRESA_ID], "empresas_suscritas wiped in patch step 2"
        # centros_suscritos must reflect [CENTRO_ID]
        assert "centros_suscritos" in patch_2_resp_json, "centros_suscritos missing in response step 2"
        assert patch_2_resp_json["centros_suscritos"] == [CENTRO_ID], "centros_suscritos not updated in patch step 2"

        # Subsequent GET to verify persisted state
        get_after_patch_resp = requests.get(
            f"{USUARIO_SUSCRIPCIONES_URL}/{user_id}", headers=headers, timeout=TIMEOUT
        )
        assert get_after_patch_resp.status_code == 200, f"GET after PATCH failed: {get_after_patch_resp.text}"
        after_patch_data = get_after_patch_resp.json()
        # empresas_suscritas remains unchanged from step 1 patch
        assert after_patch_data.get("empresas_suscritas") == [EMPRESA_ID], "empresas_suscritas wiped after patch step 2"
        # centros_suscritos updated as per step 2 patch
        assert after_patch_data.get("centros_suscritos") == [CENTRO_ID], "centros_suscritos not updated after patch step 2"

    finally:
        # Restore original user subscriptions state
        restore_body = {
            "notificar_todas_empresas": True,
            "empresas_suscritas": [],
            "centros_suscritos": [],
            "proyectos_suscritos": [],
        }
        restore_resp = requests.patch(
            f"{USUARIO_SUSCRIPCIONES_URL}/{user_id}/suscripciones",
            json=restore_body,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert restore_resp.status_code == 200, f"Failed to restore original state: {restore_resp.text}"

test_patch_suscripciones_partial_no_borra_arrays_omitidos()