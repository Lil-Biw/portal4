import requests
from requests.auth import HTTPBasicAuth

BASE_URL = "http://localhost:3000"
LOGIN_URL = f"{BASE_URL}/api/v1/auth/login"
USUARIO_SUSCRIPCIONES_URL = f"{BASE_URL}/api/v1/usuarios"

ADMIN_SMARTCLARITY_EMAIL = "test.smarclarity@gmail.com"
ADMIN_SMARTCLARITY_PASSWORD = "123123123"

TIMEOUT = 30


def test_TC021_suscripciones_rejects_invalid_mongo_id_inside_subscription_arrays():
    # Step 1: Login as admin_smartclarity user
    auth_response = requests.post(
        LOGIN_URL,
        json={"email": ADMIN_SMARTCLARITY_EMAIL, "password": ADMIN_SMARTCLARITY_PASSWORD},
        timeout=TIMEOUT,
    )
    assert auth_response.status_code == 200, f"Login failed with {auth_response.status_code}"
    auth_json = auth_response.json()
    access_token = auth_json.get("access_token")
    usuario = auth_json.get("usuario")
    assert access_token, "No access_token received"
    assert usuario, "No usuario data received"

    user_id = usuario.get("id")
    assert user_id, "User ID not found in usuario data"

    headers = {"Authorization": f"Bearer {access_token}"}

    # Step 2: GET own user data to record current subscription fields
    get_user_resp = requests.get(
        f"{USUARIO_SUSCRIPCIONES_URL}/{user_id}",
        headers=headers,
        timeout=TIMEOUT,
    )
    assert get_user_resp.status_code == 200, f"GET user failed with {get_user_resp.status_code}"
    user_data = get_user_resp.json()

    # Record current subscription-related fields
    original_notificar_todas_empresas = user_data.get("notificar_todas_empresas")
    original_empresas_suscritas = user_data.get("empresas_suscritas")
    original_centros_suscritos = user_data.get("centros_suscritos")
    original_proyectos_suscritos = user_data.get("proyectos_suscritos")

    # Step 3: PATCH with invalid mongo id inside empresas_suscritas array
    patch_payload = {
        "notificar_todas_empresas": True,
        "empresas_suscritas": ["not-a-valid-object-id"]
    }
    patch_resp = requests.patch(
        f"{USUARIO_SUSCRIPCIONES_URL}/{user_id}/suscripciones",
        json=patch_payload,
        headers=headers,
        timeout=TIMEOUT,
    )
    # Expect 400 Bad Request due to invalid mongo id validation
    assert patch_resp.status_code == 400, f"PATCH did not fail as expected, got {patch_resp.status_code}"

    # Step 4: GET the user data again to verify no partial update happened
    get_user_after_patch_resp = requests.get(
        f"{USUARIO_SUSCRIPCIONES_URL}/{user_id}",
        headers=headers,
        timeout=TIMEOUT,
    )
    assert get_user_after_patch_resp.status_code == 200, f"GET after failed PATCH failed with {get_user_after_patch_resp.status_code}"
    user_data_after_patch = get_user_after_patch_resp.json()

    # Check subscription fields are unchanged vs original recorded values
    assert user_data_after_patch.get("notificar_todas_empresas") == original_notificar_todas_empresas, "notificar_todas_empresas changed after failed PATCH"
    assert user_data_after_patch.get("empresas_suscritas") == original_empresas_suscritas, "empresas_suscritas changed after failed PATCH"
    assert user_data_after_patch.get("centros_suscritos") == original_centros_suscritos, "centros_suscritos changed after failed PATCH"
    assert user_data_after_patch.get("proyectos_suscritos") == original_proyectos_suscritos, "proyectos_suscritos changed after failed PATCH"


test_TC021_suscripciones_rejects_invalid_mongo_id_inside_subscription_arrays()