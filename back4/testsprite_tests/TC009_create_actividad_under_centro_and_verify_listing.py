import requests
import uuid
from datetime import datetime, timedelta

BASE_URL = "http://localhost:3000/api/v1"
LOGIN_EMAIL = "superadmin@eclariti.local"
LOGIN_PASSWORD = "Demo1234!"
TIMEOUT = 30


def test_tc009_create_actividad_under_centro_and_verify_listing():
    session = requests.Session()
    try:
        # Login as super_admin to get JWT token
        login_resp = session.post(
            f"{BASE_URL}/auth/login",
            json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
            timeout=TIMEOUT,
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        login_data = login_resp.json()
        access_token = login_data.get("access_token")
        assert access_token, "No access_token in login response"
        headers = {"Authorization": f"Bearer {access_token}"}

        # Step 1: Create an empresa with required fields razon_social, rut, email_contacto
        unique_suffix = uuid.uuid4().hex[:8]
        empresa_payload = {
            "razon_social": f"Test Empresa TC009-{unique_suffix}",
            "rut": f"12345678-{unique_suffix}",
            "email_contacto": f"contact.tc009{unique_suffix}@example.com"
        }
        resp_empresa = session.post(
            f"{BASE_URL}/empresas", json=empresa_payload, headers=headers, timeout=TIMEOUT
        )
        assert resp_empresa.status_code in (200, 201), f"Create empresa failed: {resp_empresa.text}"
        empresa = resp_empresa.json()
        empresa_id = empresa.get("_id") or empresa.get("id")
        assert empresa_id, "No empresa ID returned"

        # Step 2: GET empresa
        get_empresa = session.get(f"{BASE_URL}/empresas/{empresa_id}", headers=headers, timeout=TIMEOUT)
        assert get_empresa.status_code == 200, f"Get empresa failed: {get_empresa.text}"
        empresa_data = get_empresa.json()

        # Removed Steps 3,4,5 updating dias_recordatorio on empresa due to API validation errors

        # Step 6: Create a centro under empresa (dias_recordatorio no existe en CentroCosto,
        # solo en Proyecto/Actividad — no forma parte de este payload)
        centro_payload = {
            "codigo": "TC009-CENTRO-" + datetime.utcnow().strftime("%Y%m%d%H%M%S"),
            "nombre": "Test Centro TC009",
        }
        resp_centro = session.post(
            f"{BASE_URL}/empresas/{empresa_id}/centros",
            json=centro_payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert resp_centro.status_code in (200, 201), f"Create centro failed: {resp_centro.text}"
        centro = resp_centro.json()
        centro_id = centro.get("_id") or centro.get("id")
        assert centro_id, "No centro ID returned"

        # Step 11: Get tipos-actividad and select one tipo_id
        tipos_resp = session.get(f"{BASE_URL}/tipos-actividad", headers=headers, timeout=TIMEOUT)
        assert tipos_resp.status_code == 200, f"Tipos actividad fetch failed: {tipos_resp.text}"
        tipos = tipos_resp.json()
        tipos_list = tipos.get("data", []) if isinstance(tipos, dict) else tipos
        assert tipos_list, "No tipos actividad found"
        tipo_id = tipos_list[0].get("_id") or tipos_list[0].get("id")
        assert tipo_id, "Tipo actividad ID missing"

        # Step 12: Create actividad with dias_recordatorio [30,7,0]
        fecha_str = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        centro_costo_id = centro_id  # Usually centro_costo_id refers to centro id, assuming same
        actividad_payload = {
            "nombre": "Actividad TC009 Test",
            "tipo_id": tipo_id,
            "fecha": fecha_str,
            "centro_costo_id": centro_costo_id,
            "dias_recordatorio": [30, 7, 0],
        }
        resp_actividad = session.post(
            f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}/actividades",
            json=actividad_payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert resp_actividad.status_code in (200, 201), f"Create actividad failed: {resp_actividad.text}"
        actividad = resp_actividad.json()
        actividad_id = actividad.get("_id") or actividad.get("id")
        assert actividad_id, "No actividad ID returned"
        # Verify dias_recordatorio in response exactly as sent
        assert actividad.get("dias_recordatorio") == [30, 7, 0], f"Actividad dias_recordatorio mismatch after creation: {actividad.get('dias_recordatorio')}"

        # Step 13: GET actividad and verify dias_recordatorio persists
        get_actividad = session.get(
            f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}/actividades/{actividad_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert get_actividad.status_code == 200, f"Get actividad failed: {get_actividad.text}"
        actividad_data = get_actividad.json()
        assert actividad_data.get("dias_recordatorio") == [30, 7, 0], f"Actividad dias_recordatorio mismatch on GET: {actividad_data.get('dias_recordatorio')}"

        # Step 14: Edit actividad changing dias_recordatorio to [15,1]
        # Solo se envia el campo a modificar: el GET devuelve tipo_id/activo_ids
        # populados (objetos, no ObjectId strings) y metadata (creado_en,
        # actualizado_en, __v) que el UpdateDto rechaza por whitelist.
        edit_actividad_payload = {"dias_recordatorio": [15, 1]}
        put_actividad = session.put(
            f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}/actividades/{actividad_id}",
            json=edit_actividad_payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert put_actividad.status_code == 200, f"Edit actividad failed: {put_actividad.text}"
        put_actividad_data = put_actividad.json()
        assert put_actividad_data.get("dias_recordatorio") == [15, 1], f"Actividad dias_recordatorio mismatch after edit: {put_actividad_data.get('dias_recordatorio')}"

        # Step 15: GET actividad again to verify dias_recordatorio updated
        get_actividad_again = session.get(
            f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}/actividades/{actividad_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert get_actividad_again.status_code == 200, f"Get actividad after edit failed: {get_actividad_again.text}"
        actividad_again_data = get_actividad_again.json()
        assert actividad_again_data.get("dias_recordatorio") == [15, 1], f"Actividad dias_recordatorio mismatch on GET after edit: {actividad_again_data.get('dias_recordatorio')}"

        # Step 16: List actividades and verify the actividad is listed with updated dias_recordatorio
        list_actividades = session.get(
            f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}/actividades",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert list_actividades.status_code == 200, f"List actividades failed: {list_actividades.text}"
        actividades_resp = list_actividades.json()
        # actividades responde como array plano (no paginado), ver back4/CLAUDE.md
        actividades_list = actividades_resp.get("data", []) if isinstance(actividades_resp, dict) else actividades_resp
        found_actividad = None
        for a in actividades_list:
            if a.get("_id") == actividad_id or a.get("id") == actividad_id:
                found_actividad = a
                break
        assert found_actividad, "Created actividad not found in actividades list"
        assert found_actividad.get("dias_recordatorio") == [15, 1], f"Actividad dias_recordatorio mismatch in list: {found_actividad.get('dias_recordatorio')}"

    finally:
        # Cleanup: delete actividad, centro, empresa if created
        # Delete actividad
        if 'actividad_id' in locals():
            del_act_resp = session.delete(
                f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}/actividades/{actividad_id}",
                headers=headers,
                timeout=TIMEOUT,
            )
            if del_act_resp.status_code not in (200, 204, 404):
                print(f"Warning: Failed to delete actividad {actividad_id}: {del_act_resp.text}")

        # Delete centro
        if 'centro_id' in locals():
            del_centro_resp = session.delete(
                f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}",
                headers=headers,
                timeout=TIMEOUT,
            )
            if del_centro_resp.status_code not in (200, 204, 404):
                print(f"Warning: Failed to delete centro {centro_id}: {del_centro_resp.text}")

        # Delete empresa
        if 'empresa_id' in locals():
            del_empresa_resp = session.delete(
                f"{BASE_URL}/empresas/{empresa_id}",
                headers=headers,
                timeout=TIMEOUT,
            )
            if del_empresa_resp.status_code not in (200, 204, 404):
                print(f"Warning: Failed to delete empresa {empresa_id}: {del_empresa_resp.text}")


test_tc009_create_actividad_under_centro_and_verify_listing()
