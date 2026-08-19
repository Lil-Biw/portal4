import requests
import time
import random

BASE_URL = "http://localhost:3000/api/v1"
TIMEOUT = 30

SUPER_ADMIN_EMAIL = "superadmin@eclariti.local"
SUPER_ADMIN_PASSWORD = "Demo1234!"

def test_TC012_assign_and_revoke_permiso_for_usuario_over_centro():
    session = requests.Session()
    token = None
    headers = {}
    usuario_id = None
    centro_id = None

    # Login as super_admin
    try:
        login_resp = session.post(
            f"{BASE_URL}/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD},
            timeout=TIMEOUT,
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        login_json = login_resp.json()
        token = login_json.get("access_token")
        assert token, "No access_token received"
        headers = {"Authorization": f"Bearer {token}"}

        # Step 1: create usuario (consumidor) tied to an empresa
        # First, find an empresa whose razon_social contains "AgroSur"
        empresas_resp = session.get(f"{BASE_URL}/empresas", headers=headers, timeout=TIMEOUT)
        assert empresas_resp.status_code == 200, f"Get empresas failed: {empresas_resp.text}"
        empresas_data = empresas_resp.json()
        empresas = empresas_data.get("data", [])
        empresa_agrosur = None
        for e in empresas:
            razon = e.get("razon_social", "")
            if "AgroSur" in razon:
                empresa_agrosur = e
                break
        assert empresa_agrosur is not None, "Empresa with 'AgroSur' not found"
        cliente_id = empresa_agrosur["id"] if "id" in empresa_agrosur else empresa_agrosur.get("_id")
        assert cliente_id, "Empresa ID not found"

        # Create usuario consumidor tied to empresa Agrosur
        # Prepare unique email with timestamp/random suffix
        suffix = int(time.time() * 1000) + random.randint(0, 9999)
        usuario_email = f"test.user{suffix}@example.com"
        usuario_payload = {
            "nombre": "Test Usuario",
            "email": usuario_email,
            "rol": "usuario",
            "cliente_id": cliente_id
        }

        usuario_create_resp = session.post(
            f"{BASE_URL}/usuarios", json=usuario_payload, headers=headers, timeout=TIMEOUT
        )
        assert usuario_create_resp.status_code in (200, 201), f"Failed to create usuario: {usuario_create_resp.text}"
        usuario_json = usuario_create_resp.json()
        usuario_id = usuario_json.get("id") or usuario_json.get("_id")
        assert usuario_id, "Created usuario id not found"

        # Step 2: create centro de costo under empresa Agrosur
        centro_codigo = f"CC{suffix}"
        centro_nombre = "Centro Test Permiso"
        centro_payload = {"codigo": centro_codigo, "nombre": centro_nombre}

        centro_create_resp = session.post(
            f"{BASE_URL}/empresas/{cliente_id}/centros",
            json=centro_payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert centro_create_resp.status_code in (200, 201), f"Failed to create centro de costo: {centro_create_resp.text}"
        centro_json = centro_create_resp.json()
        centro_id = centro_json.get("id") or centro_json.get("_id")
        assert centro_id, "Created centro de costo id not found"

        # Step 3: POST /api/v1/permisos to assign usuario access to centro with tipo "ver"
        permiso_payload = {
            "usuario_id": usuario_id,
            "centro_costo_id": centro_id,
            "tipo": "ver"
        }
        permiso_resp = session.post(
            f"{BASE_URL}/permisos",
            json=permiso_payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert permiso_resp.status_code in (200,201), f"Failed to assign permiso: {permiso_resp.text}"
        permiso_json = permiso_resp.json()
        assert permiso_json is not None, "Permiso creation returned empty"

        # Step 4: GET /api/v1/permisos/usuario/:usuarioId to verify permiso appears
        permisos_usuario_resp = session.get(
            f"{BASE_URL}/permisos/usuario/{usuario_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert permisos_usuario_resp.status_code == 200, f"Failed to get permisos usuario: {permisos_usuario_resp.text}"
        permisos_usuario = permisos_usuario_resp.json()
        permisos_list = permisos_usuario if isinstance(permisos_usuario, list) else permisos_usuario.get("data", permisos_usuario)
        # permisos_usuario endpoint likely returns array or data list, accept both
        # Check at least one permiso matches centro_id and tipo 'ver'
        found_permiso = False
        if isinstance(permisos_list, list):
            for p in permisos_list:
                if p.get("centro_costo_id") == centro_id and p.get("usuario_id") == usuario_id and p.get("tipo") == "ver":
                    found_permiso = True
                    break
        else:
            # if not list, check keys directly
            if (
                permisos_list.get("centro_costo_id") == centro_id
                and permisos_list.get("usuario_id") == usuario_id
                and permisos_list.get("tipo") == "ver"
            ):
                found_permiso = True
        assert found_permiso, "Assigned permiso not found in permisos list"

        # Step 5: DELETE /api/v1/permisos/usuario/:usuarioId/centro/:centroId to revoke permiso
        permiso_delete_resp = session.delete(
            f"{BASE_URL}/permisos/usuario/{usuario_id}/centro/{centro_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert permiso_delete_resp.status_code in (200, 204), f"Failed to delete permiso: {permiso_delete_resp.text}"

        # Step 6: GET permisos again to verify it no longer appears
        permisos_usuario_resp_after = session.get(
            f"{BASE_URL}/permisos/usuario/{usuario_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert permisos_usuario_resp_after.status_code == 200, f"Failed to get permisos usuario after deletion: {permisos_usuario_resp_after.text}"
        permisos_usuario_after = permisos_usuario_resp_after.json()
        permisos_list_after = permisos_usuario_after if isinstance(permisos_usuario_after, list) else permisos_usuario_after.get("data", permisos_usuario_after)
        found_permiso_after = False
        if isinstance(permisos_list_after, list):
            for p in permisos_list_after:
                if p.get("centro_costo_id") == centro_id and p.get("usuario_id") == usuario_id and p.get("tipo") == "ver":
                    found_permiso_after = True
                    break
        else:
            if (
                permisos_list_after.get("centro_costo_id") == centro_id
                and permisos_list_after.get("usuario_id") == usuario_id
                and permisos_list_after.get("tipo") == "ver"
            ):
                found_permiso_after = True
        assert not found_permiso_after, "Permiso still present after deletion"

    finally:
        # Cleanup: delete usuario and centro de costo if created
        if usuario_id:
            try:
                session.delete(f"{BASE_URL}/usuarios/{usuario_id}", headers=headers, timeout=TIMEOUT)
            except Exception:
                pass
        if centro_id and cliente_id:
            try:
                session.delete(f"{BASE_URL}/empresas/{cliente_id}/centros/{centro_id}", headers=headers, timeout=TIMEOUT)
            except Exception:
                pass

test_TC012_assign_and_revoke_permiso_for_usuario_over_centro()
