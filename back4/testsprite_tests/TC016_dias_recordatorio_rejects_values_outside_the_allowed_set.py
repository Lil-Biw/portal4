import requests
import uuid
from datetime import datetime, timedelta

BASE_URL = "http://localhost:3000/api/v1"
SUPER_ADMIN_EMAIL = "superadmin@eclariti.local"
SUPER_ADMIN_PASSWORD = "Demo1234!"
TIMEOUT = 30


def test_TC016_dias_recordatorio_rejects_invalid_values():
    session = requests.Session()
    try:
        # Login as super_admin
        login_resp = session.post(
            f"{BASE_URL}/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD},
            timeout=TIMEOUT,
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("access_token")
        assert token, "No access_token received"
        session.headers.update({"Authorization": f"Bearer {token}"})

        # Create empresa with required fields
        unique_empresa_suffix = uuid.uuid4().hex[:8]
        empresa_payload = {
            "razon_social": f"Test Empresa TC016 {unique_empresa_suffix}",
            "rut": f"12345678-{unique_empresa_suffix[:1]}",
            "email_contacto": f"contact{unique_empresa_suffix}@eclariti.local"
        }
        create_empresa_resp = session.post(
            f"{BASE_URL}/empresas", json=empresa_payload, timeout=TIMEOUT
        )
        assert create_empresa_resp.status_code in (200, 201), f"Empresa creation failed: {create_empresa_resp.text}"
        empresa_data = create_empresa_resp.json()
        empresa_id = empresa_data.get("_id") or empresa_data.get("id")
        assert empresa_id, "Empresa ID missing in creation response"

        # Create centro in empresa
        unique_centro_code = f"centro-{uuid.uuid4().hex[:8]}"
        centro_payload = {"codigo": unique_centro_code, "nombre": "Centro TC016"}
        create_centro_resp = session.post(
            f"{BASE_URL}/empresas/{empresa_id}/centros",
            json=centro_payload,
            timeout=TIMEOUT,
        )
        assert create_centro_resp.status_code in (200, 201), f"Centro creation failed: {create_centro_resp.text}"
        centro_data = create_centro_resp.json()
        centro_id = centro_data.get("_id") or centro_data.get("id")
        assert centro_id, "Centro ID missing in creation response"

        # To create proyecto, need cliente_id and centro_costo_ids.
        # cliente_id should be empresa_id (usually), centro_costo_ids array with centro_id.

        # For codigo and nombre: unique values to avoid conflict
        proyecto_codigo = f"pry-invalid-{uuid.uuid4().hex[:6]}"
        proyecto_nombre = "Proyecto Invalid Dias Recordatorio"
        proyecto_payload_invalid = {
            "codigo": proyecto_codigo,
            "nombre": proyecto_nombre,
            "cliente_id": empresa_id,
            "centro_costo_ids": [centro_id],
            "dias_recordatorio": [5],  # Invalid value, not in [30,15,7,3,1,0]
        }

        # Attempt to create proyecto with invalid dias_recordatorio
        post_invalid_resp = session.post(
            f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}/proyectos",
            json=proyecto_payload_invalid,
            timeout=TIMEOUT,
        )
        assert post_invalid_resp.status_code == 400, (
            f"Expected 400 for invalid dias_recordatorio but got "
            f"{post_invalid_resp.status_code}: {post_invalid_resp.text}"
        )

        # Now create proyecto with valid dias_recordatorio
        proyecto_codigo_valid = f"pry-valid-{uuid.uuid4().hex[:6]}"
        # fecha_fin es requerida para que dias_recordatorio realmente persista
        # (Recordatorio.fecha_fin es obligatoria en el schema; sin fecha_fin la API
        # responde consistentemente dias_recordatorio: [] tanto en POST como en GET)
        fecha_fin_str = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
        proyecto_payload_valid = {
            "codigo": proyecto_codigo_valid,
            "nombre": "Proyecto Valid Dias Recordatorio",
            "cliente_id": empresa_id,
            "centro_costo_ids": [centro_id],
            "fecha_fin": fecha_fin_str,
            "dias_recordatorio": [7, 1, 0],  # Valid set
        }

        create_valid_resp = session.post(
            f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}/proyectos",
            json=proyecto_payload_valid,
            timeout=TIMEOUT,
        )
        assert create_valid_resp.status_code in (200, 201), (
            f"Valid proyecto creation failed: {create_valid_resp.status_code} - {create_valid_resp.text}"
        )
        proyecto_data = create_valid_resp.json()
        proyecto_id = proyecto_data.get("_id") or proyecto_data.get("id")
        assert proyecto_id, "Proyecto ID missing in successful creation response"

        # Verify response contains exact dias_recordatorio
        resp_dias = proyecto_data.get("dias_recordatorio")
        assert isinstance(resp_dias, list), "dias_recordatorio in response is not a list"
        assert sorted(resp_dias) == sorted([7, 1, 0]), f"dias_recordatorio mismatch: expected [7,1,0], got {resp_dias}"

        # GET the proyecto and verify dias_recordatorio remains correct
        get_proyecto_resp = session.get(
            f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}/proyectos/{proyecto_id}",
            timeout=TIMEOUT,
        )
        assert get_proyecto_resp.status_code == 200, f"Get proyecto failed: {get_proyecto_resp.text}"
        get_proyecto_data = get_proyecto_resp.json()
        get_dias = get_proyecto_data.get("dias_recordatorio")
        assert isinstance(get_dias, list), "dias_recordatorio missing or not list in GET proyecto"
        assert sorted(get_dias) == sorted([7, 1, 0]), f"dias_recordatorio mismatch on GET: expected [7,1,0], got {get_dias}"

    finally:
        # Cleanup: delete created proyecto if exists
        try:
            if 'proyecto_id' in locals():
                del_proj_resp = session.delete(
                    f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}/proyectos/{proyecto_id}",
                    timeout=TIMEOUT,
                )
                assert del_proj_resp.status_code in (200, 204), f"Delete proyecto failed: {del_proj_resp.text}"
        except Exception:
            pass
        # Cleanup: delete centro
        try:
            if 'centro_id' in locals():
                del_centro_resp = session.delete(
                    f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}",
                    timeout=TIMEOUT,
                )
                assert del_centro_resp.status_code in (200, 204), f"Delete centro failed: {del_centro_resp.text}"
        except Exception:
            pass
        # Cleanup: delete empresa
        try:
            if 'empresa_id' in locals():
                del_empresa_resp = session.delete(
                    f"{BASE_URL}/empresas/{empresa_id}",
                    timeout=TIMEOUT,
                )
                assert del_empresa_resp.status_code in (200, 204), f"Delete empresa failed: {del_empresa_resp.text}"
        except Exception:
            pass


test_TC016_dias_recordatorio_rejects_invalid_values()
