import requests
import uuid

BASE_URL = "http://localhost:3000/api/v1"
TIMEOUT = 30


def test_full_crud_lifecycle_empresa_as_super_admin():
    # Step 1: Login as super_admin
    login_url = f"{BASE_URL}/auth/login"
    login_payload = {
        "email": "superadmin@eclariti.local",
        "password": "Demo1234!"
    }
    try:
        login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_data = login_resp.json()
        access_token = login_data.get("access_token")
        assert access_token, "No access_token received on login"
    except requests.RequestException as e:
        assert False, f"Exception during login: {e}"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    # Step 2: POST /api/v1/empresas to create a new empresa
    unique_rut_suffix = str(uuid.uuid4())[:8]
    empresa_payload = {
        "razon_social": "Empresa Test S.A.",
        "rut": f"76.543.210-{unique_rut_suffix}",
        "email_contacto": "contacto@empresatest.cl"
    }
    empresa_id = None
    try:
        create_resp = requests.post(f"{BASE_URL}/empresas", json=empresa_payload, headers=headers, timeout=TIMEOUT)
        assert create_resp.status_code in (200, 201), f"Crear empresa failed with status {create_resp.status_code}"
        create_data = create_resp.json()
        # The API returns the created empresa; id might be in "_id" or "id"
        if isinstance(create_data, dict):
            if "_id" in create_data:
                empresa_id = create_data["_id"]
            elif "id" in create_data:
                empresa_id = create_data["id"]
            else:
                # Sometimes response could be nested or return data in a key
                # As the PRD example for GET says items use "_id", we expect _id here
                for val in create_data.values():
                    if isinstance(val, dict) and "_id" in val:
                        empresa_id = val["_id"]
                        break
        assert empresa_id is not None, "No empresa ID returned on creation"

        # Step 3: GET /api/v1/empresas/:id to confirm it exists
        get_resp = requests.get(f"{BASE_URL}/empresas/{empresa_id}", headers=headers, timeout=TIMEOUT)
        assert get_resp.status_code == 200, f"GET empresa failed with status {get_resp.status_code}"
        get_data = get_resp.json()
        assert get_data.get("_id", get_data.get("id")) == empresa_id, "Empresa ID mismatch on GET"
        assert get_data.get("razon_social") == empresa_payload["razon_social"], "Empresa razon_social mismatch on GET"

        # Step 4: PUT /api/v1/empresas/:id to update its name
        updated_name = "Empresa Test Actualizada S.A."
        update_payload = {"razon_social": updated_name}
        put_resp = requests.put(f"{BASE_URL}/empresas/{empresa_id}", json=update_payload, headers=headers, timeout=TIMEOUT)
        assert put_resp.status_code in (200, 204), f"PUT empresa failed with status {put_resp.status_code}"

        # Confirm update by GET again
        get_updated_resp = requests.get(f"{BASE_URL}/empresas/{empresa_id}", headers=headers, timeout=TIMEOUT)
        assert get_updated_resp.status_code == 200, f"GET updated empresa failed with status {get_updated_resp.status_code}"
        updated_data = get_updated_resp.json()
        # The updated razon_social must match
        assert updated_data.get("razon_social") == updated_name, "Empresa razon_social not updated"

        # Step 5: DELETE /api/v1/empresas/:id
        del_resp = requests.delete(f"{BASE_URL}/empresas/{empresa_id}", headers=headers, timeout=TIMEOUT)
        assert del_resp.status_code in (200, 204), f"DELETE empresa failed with status {del_resp.status_code}"

        # Step 6: Confirm subsequent GET returns 404
        get_deleted_resp = requests.get(f"{BASE_URL}/empresas/{empresa_id}", headers=headers, timeout=TIMEOUT)
        assert get_deleted_resp.status_code == 404, f"GET after delete should be 404 but got {get_deleted_resp.status_code}"

    finally:
        # Cleanup: ensure empresa is deleted if it was created and still exists
        if empresa_id:
            try:
                # Attempt to delete silently
                _ = requests.delete(f"{BASE_URL}/empresas/{empresa_id}", headers=headers, timeout=TIMEOUT)
            except Exception:
                pass


test_full_crud_lifecycle_empresa_as_super_admin()