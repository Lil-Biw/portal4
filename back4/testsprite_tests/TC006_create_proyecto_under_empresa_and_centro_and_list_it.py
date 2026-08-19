import requests
import uuid
from datetime import datetime, timedelta

BASE_URL = "http://localhost:3000/api/v1"
AUTH_URL = f"{BASE_URL}/auth/login"
EMPRESAS_URL = f"{BASE_URL}/empresas"

SUPER_ADMIN_EMAIL = "superadmin@eclariti.local"
SUPER_ADMIN_PASSWORD = "Demo1234!"

HEADERS_JSON = {"Content-Type": "application/json"}


def test_tc006_create_proyecto_under_empresa_and_centro_and_list_it():
    timeout = 30
    token = None
    empresa_id = None
    centro_id = None
    proyecto_id = None

    def auth_super_admin():
        resp = requests.post(
            AUTH_URL,
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD},
            headers=HEADERS_JSON,
            timeout=timeout,
        )
        assert resp.status_code == 200, f"Login failed with status {resp.status_code}"
        data = resp.json()
        assert "access_token" in data and "usuario" in data, "Invalid login response"
        return data["access_token"]

    def create_empresa(jwt_token):
        unique_suffix = uuid.uuid4().hex[:8]
        payload = {
            "razon_social": f"Empresa Test TC006-{unique_suffix}",
            "rut": f"123456789-{unique_suffix}",
            "email_contacto": f"contacto{unique_suffix}@example.com"
        }
        headers = {"Authorization": f"Bearer {jwt_token}", **HEADERS_JSON}
        resp = requests.post(EMPRESAS_URL, json=payload, headers=headers, timeout=timeout)
        assert resp.status_code in [200, 201], f"Create empresa failed: {resp.text}"
        e_data = resp.json()
        assert "_id" in e_data, "Empresa creation response no _id"
        return e_data["_id"]

    def delete_empresa(jwt_token, empresa_id_):
        if empresa_id_ is None:
            return
        headers = {"Authorization": f"Bearer {jwt_token}"}
        resp = requests.delete(f"{EMPRESAS_URL}/{empresa_id_}", headers=headers, timeout=timeout)
        # Could be 200, 204 or 404 if already deleted
        assert resp.status_code in [200, 204, 404], f"Delete empresa failed: {resp.text}"

    def create_centro(jwt_token, empresa_id_):
        unique_code = f"CTC_TC006_{uuid.uuid4()}"
        unique_name = f"Centro TC006 {uuid.uuid4()}"
        url = f"{EMPRESAS_URL}/{empresa_id_}/centros"
        payload = {"codigo": unique_code, "nombre": unique_name}
        headers = {"Authorization": f"Bearer {jwt_token}", **HEADERS_JSON}
        resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
        assert resp.status_code in [200,201], f"Create centro failed: {resp.text}"
        c_data = resp.json()
        assert "_id" in c_data, "Centro creation response no _id"
        return c_data["_id"]

    def delete_centro(jwt_token, empresa_id_, centro_id_):
        if centro_id_ is None:
            return
        headers = {"Authorization": f"Bearer {jwt_token}"}
        resp = requests.delete(f"{EMPRESAS_URL}/{empresa_id_}/centros/{centro_id_}", headers=headers, timeout=timeout)
        # Could be 200,204 or 404
        assert resp.status_code in [200,204,404], f"Delete centro failed: {resp.text}"

    def create_proyecto(jwt_token, empresa_id_, centro_id_, dias_recordatorio):
        url = f"{EMPRESAS_URL}/{empresa_id_}/centros/{centro_id_}/proyectos"
        unique_code = f"PROYECTO_TC006_{uuid.uuid4()}"
        # fecha_fin es requerida para que dias_recordatorio persista de verdad
        # (Recordatorio.fecha_fin es obligatoria en el schema)
        fecha_fin_str = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
        payload = {
            "codigo": unique_code,
            "nombre": f"Proyecto Test {unique_code}",
            "cliente_id": empresa_id_,
            "centro_costo_ids": [centro_id_],
            "fecha_fin": fecha_fin_str,
            "dias_recordatorio": dias_recordatorio
        }
        headers = {"Authorization": f"Bearer {jwt_token}", **HEADERS_JSON}
        resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
        assert resp.status_code in [200,201], f"Create proyecto failed: {resp.text}"
        p_data = resp.json()
        # Validate dias_recordatorio exact match
        assert "dias_recordatorio" in p_data, "Response missing dias_recordatorio"
        assert sorted(p_data["dias_recordatorio"]) == sorted(dias_recordatorio), "dias_recordatorio mismatch on creation"
        assert "_id" in p_data, "Proyecto creation missing _id"
        return p_data["_id"], p_data

    def get_proyectos(jwt_token, empresa_id_, centro_id_):
        url = f"{EMPRESAS_URL}/{empresa_id_}/centros/{centro_id_}/proyectos"
        headers = {"Authorization": f"Bearer {jwt_token}"}
        resp = requests.get(url, headers=headers, timeout=timeout)
        assert resp.status_code == 200, f"Get proyectos failed: {resp.text}"
        return resp.json()

    def get_proyecto(jwt_token, empresa_id_, centro_id_, proyecto_id_):
        url = f"{EMPRESAS_URL}/{empresa_id_}/centros/{centro_id_}/proyectos/{proyecto_id_}"
        headers = {"Authorization": f"Bearer {jwt_token}"}
        resp = requests.get(url, headers=headers, timeout=timeout)
        assert resp.status_code == 200, f"Get proyecto failed: {resp.text}"
        return resp.json()

    def update_proyecto(jwt_token, empresa_id_, centro_id_, proyecto_id_, dias_recordatorio_new):
        url = f"{EMPRESAS_URL}/{empresa_id_}/centros/{centro_id_}/proyectos/{proyecto_id_}"
        payload = {"dias_recordatorio": dias_recordatorio_new}
        headers = {"Authorization": f"Bearer {jwt_token}", **HEADERS_JSON}
        resp = requests.put(url, json=payload, headers=headers, timeout=timeout)
        assert resp.status_code == 200, f"Update proyecto failed: {resp.text}"
        p_data = resp.json()
        assert "dias_recordatorio" in p_data, "Update response missing dias_recordatorio"
        assert sorted(p_data["dias_recordatorio"]) == sorted(dias_recordatorio_new), "dias_recordatorio mismatch on update"
        return p_data

    token = auth_super_admin()
    try:
        empresa_id = create_empresa(token)
        try:
            centro_id = create_centro(token, empresa_id)
            try:
                # Step 1: Create proyecto with dias_recordatorio = [30,7,0]
                dias_init = [30, 7, 0]
                proyecto_id, proyecto_created = create_proyecto(token, empresa_id, centro_id, dias_init)

                # Step 2: GET proyecto individually to check dias_recordatorio
                proyecto_get = get_proyecto(token, empresa_id, centro_id, proyecto_id)
                assert "dias_recordatorio" in proyecto_get, "GET proyecto missing dias_recordatorio"
                assert sorted(proyecto_get["dias_recordatorio"]) == sorted(dias_init), "dias_recordatorio mismatch on GET individual"

                # Step 3: Update proyecto with dias_recordatorio = [15,1]
                dias_updated = [15, 1]
                proyecto_updated = update_proyecto(token, empresa_id, centro_id, proyecto_id, dias_updated)

                # Step 4: GET proyecto again to verify updated dias_recordatorio
                proyecto_get_updated = get_proyecto(token, empresa_id, centro_id, proyecto_id)
                assert "dias_recordatorio" in proyecto_get_updated, "GET updated proyecto missing dias_recordatorio"
                assert sorted(proyecto_get_updated["dias_recordatorio"]) == sorted(dias_updated), "dias_recordatorio mismatch on GET after update"

                # Step 5: GET list of proyectos and verify the updated proyecto is listed with correct dias_recordatorio
                proyectos_resp = get_proyectos(token, empresa_id, centro_id)
                proyectos_list = proyectos_resp.get("data", []) if isinstance(proyectos_resp, dict) else proyectos_resp
                assert isinstance(proyectos_list, list), "Proyectos list response is not a list"
                found = False
                for proyecto in proyectos_list:
                    if proyecto.get("_id") == proyecto_id:
                        found = True
                        assert "dias_recordatorio" in proyecto, "Listado proyecto missing dias_recordatorio"
                        assert sorted(proyecto["dias_recordatorio"]) == sorted(dias_updated), "dias_recordatorio mismatch in list after update"
                        break
                assert found, "Proyecto not found in proyectos list"

            finally:
                if proyecto_id:
                    headers = {"Authorization": f"Bearer {token}"}
                    resp_del_proy = requests.delete(f"{EMPRESAS_URL}/{empresa_id}/centros/{centro_id}/proyectos/{proyecto_id}",
                                                   headers=headers, timeout=timeout)
                    assert resp_del_proy.status_code in [200,204,404], f"Delete proyecto failed: {resp_del_proy.text}"
                if centro_id:
                    delete_centro(token, empresa_id, centro_id)
        finally:
            if empresa_id:
                delete_empresa(token, empresa_id)
    except AssertionError:
        raise

test_tc006_create_proyecto_under_empresa_and_centro_and_list_it()
