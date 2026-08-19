import requests

BASE_URL = "http://localhost:3000/api/v1"
TIMEOUT = 30

def test_TC010_create_solicitud_and_update_estado():
    # Login as super_admin
    login_url = f"{BASE_URL}/auth/login"
    login_payload = {
        "email": "superadmin@eclariti.local",
        "password": "Demo1234!"
    }
    try:
        login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        login_data = login_resp.json()
        access_token = login_data.get("access_token")
        assert access_token, "No access_token in login response"
    except Exception as e:
        assert False, f"Exception during login: {e}"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    empresa_id = None
    solicitud_id = None

    # Create empresa
    empresa_url = f"{BASE_URL}/empresas"
    empresa_payload = {
        "razon_social": "Empresa Test TC010",
        "rut": "99999999-1",
        "direccion": {
            "calle": "Calle Falsa"
        },
        "telefono": "123456789",
        "email_contacto": "contacto@testempresa.com"
    }

    try:
        empresa_resp = requests.post(empresa_url, json=empresa_payload, headers=headers, timeout=TIMEOUT)
        assert empresa_resp.status_code in (200,201), f"Empresa creation failed: {empresa_resp.text}"
        empresa_data = empresa_resp.json()
        empresa_id = empresa_data.get("id") or empresa_data.get("_id")
        assert empresa_id, "No empresa ID returned on creation"

        # Create solicitud
        solicitud_url = f"{BASE_URL}/empresas/{empresa_id}/solicitudes"
        solicitud_payload = {
            "nombre": "Solicitud de prueba TC010",
            "descripcion": "Descripcion de la solicitud",
            "tipo": "documento"
        }
        solicitud_resp = requests.post(solicitud_url, json=solicitud_payload, headers=headers, timeout=TIMEOUT)
        assert solicitud_resp.status_code in (200,201), f"Solicitud creation failed: {solicitud_resp.text}"
        solicitud_data = solicitud_resp.json()
        solicitud_id = solicitud_data.get("id") or solicitud_data.get("_id")
        assert solicitud_id, "No solicitud ID returned on creation"

        # Update estado from pendiente to revision
        update_estado_url = f"{BASE_URL}/empresas/{empresa_id}/solicitudes/{solicitud_id}/estado"
        estado_payload = {
            "estado": "revision"
        }
        update_resp = requests.put(update_estado_url, json=estado_payload, headers=headers, timeout=TIMEOUT)
        assert update_resp.status_code == 200, f"Estado update failed: {update_resp.text}"
        updated_data = update_resp.json()

        # Get solicitudes list to verify estado updated
        list_url = f"{BASE_URL}/empresas/{empresa_id}/solicitudes"
        list_resp = requests.get(list_url, headers=headers, timeout=TIMEOUT)
        assert list_resp.status_code == 200, f"Solicitud list retrieval failed: {list_resp.text}"
        solicitudes = list_resp.json()
        assert isinstance(solicitudes, list), "Solicitudes list response is not a list"
        found = False
        for sol in solicitudes:
            sid = sol.get("id") or sol.get("_id")
            if sid == solicitud_id:
                found = True
                estado_actual = sol.get("estado")
                assert estado_actual == "revision", f"Solicitud estado was not updated, current: {estado_actual}"
                break
        assert found, "Created solicitud not found in solicitudes list"

    finally:
        # Clean up: delete solicitud and empresa
        if solicitud_id:
            try:
                del_solicitud_url = f"{BASE_URL}/empresas/{empresa_id}/solicitudes/{solicitud_id}"
                del_resp = requests.delete(del_solicitud_url, headers=headers, timeout=TIMEOUT)
                assert del_resp.status_code in (200, 204, 404)
            except Exception:
                pass

        if empresa_id:
            try:
                del_empresa_url = f"{BASE_URL}/empresas/{empresa_id}"
                del_empresa_resp = requests.delete(del_empresa_url, headers=headers, timeout=TIMEOUT)
                assert del_empresa_resp.status_code in (200, 204, 404)
            except Exception:
                pass

test_TC010_create_solicitud_and_update_estado()
