import requests
import time

BASE_URL = "http://localhost:3000/api/v1"
TIMEOUT = 30

def test_create_usuario_consumidor_and_verify_listing():
    login_url = f"{BASE_URL}/auth/login"
    usuarios_url = f"{BASE_URL}/usuarios"
    empresas_url = f"{BASE_URL}/empresas"

    # Credentials for super_admin
    super_admin_email = "superadmin@eclariti.local"
    super_admin_password = "Demo1234!"

    # Step 1: Login as super_admin to get access_token
    login_payload = {"email": super_admin_email, "password": super_admin_password}
    login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json().get("access_token")
    assert token and isinstance(token, str), "No access_token in login response"

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Step 2: Get empresas list (paginated)
    empresas_resp = requests.get(empresas_url, headers=headers, timeout=TIMEOUT)
    assert empresas_resp.status_code == 200, f"Failed to get empresas: {empresas_resp.text}"
    empresas_data = empresas_resp.json()
    assert "data" in empresas_data and isinstance(empresas_data["data"], list)
    assert len(empresas_data["data"]) > 0, "No empresas found"

    # Step 3: Find empresa with razon_social containing "AgroSur"
    empresa_target = None
    for empresa in empresas_data["data"]:
        razon_social = empresa.get("razon_social", "")
        if "AgroSur" in razon_social:
            empresa_target = empresa
            break
    assert empresa_target is not None, "No empresa containing 'AgroSur' found"
    empresa_id = empresa_target.get("id") or empresa_target.get("_id")
    assert empresa_id, "Empresa ID missing"

    # Step 4: Prepare usuario consumidor payload
    # We generate a unique email to avoid conflicts by timestamp
    timestamp = int(time.time() * 1000)
    new_usuario_email = f"usuario.consumidor.{timestamp}@eclariti.test"
    new_usuario_nombre = "Usuario Consumidor Test"
    new_usuario_rol = "usuario"  # as per requirement
    cliente_id = empresa_id

    usuario_payload = {
        "nombre": new_usuario_nombre,
        "email": new_usuario_email,
        "rol": new_usuario_rol,
        "cliente_id": cliente_id
    }

    # Step 5: Create new usuario consumidor POST /usuarios
    created_usuario = None
    try:
        create_resp = requests.post(usuarios_url, headers=headers, json=usuario_payload, timeout=TIMEOUT)
        assert create_resp.status_code in (200, 201), f"Failed to create usuario: {create_resp.text}"
        created_usuario = create_resp.json()
        created_id = created_usuario.get("id") or created_usuario.get("_id")
        assert created_id, "Created usuario has no id"
        assert created_usuario.get("rol") == new_usuario_rol, f"Created usuario rol mismatch: expected {new_usuario_rol}"
        assert created_usuario.get("cliente_id") == cliente_id, f"Created usuario cliente_id mismatch: expected {cliente_id}"

        # Step 6: GET /usuarios to verify the new user appears
        list_resp = requests.get(usuarios_url, headers=headers, timeout=TIMEOUT)
        assert list_resp.status_code == 200, f"Failed to list usuarios: {list_resp.text}"
        usuarios_list_resp = list_resp.json()
        assert "data" in usuarios_list_resp and isinstance(usuarios_list_resp["data"], list), "Usuarios list response should have 'data' as list"
        usuarios_list = usuarios_list_resp["data"]
        # Look for created user by email in the list
        found = False
        for usuario in usuarios_list:
            if usuario.get("email") == new_usuario_email:
                found = True
                # Verify rol and cliente_id for this usuario
                assert usuario.get("rol") == new_usuario_rol, f"Usuario rol mismatch in list"
                assert usuario.get("cliente_id") == cliente_id, f"Usuario cliente_id mismatch in list"
                break
        assert found, "Created usuario not found in usuarios list"
    finally:
        # Step 7: Clean up - delete the created usuario if exists
        if created_usuario:
            user_id = created_usuario.get("id") or created_usuario.get("_id")
            if user_id:
                del_resp = requests.delete(f"{usuarios_url}/{user_id}", headers=headers, timeout=TIMEOUT)
                assert del_resp.status_code in (200, 204), f"Failed to delete usuario in cleanup: {del_resp.text}"

test_create_usuario_consumidor_and_verify_listing()
