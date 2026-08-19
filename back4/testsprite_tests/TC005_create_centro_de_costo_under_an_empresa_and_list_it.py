import requests
import random
import string
import time

BASE_URL = "http://localhost:3000/api/v1"
LOGIN_URL = f"{BASE_URL}/auth/login"
EMPRESAS_URL = f"{BASE_URL}/empresas"

SUPER_ADMIN_EMAIL = "superadmin@eclariti.local"
SUPER_ADMIN_PASSWORD = "Demo1234!"
TIMEOUT = 30


def random_rut_suffix(length=6):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


def test_create_centro_and_list():
    session = requests.Session()

    # Login as super_admin
    login_payload = {
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD,
    }
    login_resp = session.post(LOGIN_URL, json=login_payload, timeout=TIMEOUT)
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json().get("access_token")
    assert token, "No access_token received"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Create a new empresa
    unique_rut = f"12345678-{random_rut_suffix()}"
    empresa_payload = {
        "razon_social": f"Empresa Test {int(time.time())}",
        "rut": unique_rut,
        "email_contacto": f"contacto_{random_rut_suffix()}@example.com"
    }
    empresa_resp = session.post(EMPRESAS_URL, json=empresa_payload, headers=headers, timeout=TIMEOUT)
    assert empresa_resp.status_code in (200, 201), f"Failed to create empresa: {empresa_resp.text}"
    empresa_data = empresa_resp.json()
    empresa_id = empresa_data.get("_id") or empresa_data.get("id")
    # Some APIs return '_id', others 'id'
    assert empresa_id, "Created empresa has no ID"

    try:
        # Create a centro de costo under the empresa
        centros_url = f"{EMPRESAS_URL}/{empresa_id}/centros"
        centro_payload = {
            "codigo": f"CENTRO-{random_rut_suffix(4)}",
            "nombre": f"Centro de Costo Test {int(time.time())}"
        }
        centro_resp = session.post(centros_url, json=centro_payload, headers=headers, timeout=TIMEOUT)
        assert centro_resp.status_code in (200, 201), f"Failed to create centro de costo: {centro_resp.text}"
        centro_data = centro_resp.json()
        centro_id = centro_data.get("_id") or centro_data.get("id")
        assert centro_id, "Created centro de costo has no ID"

        # Get the list of centros for the empresa and verify the new centro appears
        list_resp = session.get(centros_url, headers=headers, timeout=TIMEOUT)
        assert list_resp.status_code == 200, f"Failed to list centros: {list_resp.text}"
        list_data = list_resp.json()
        centros_list = list_data if isinstance(list_data, list) else list_data.get("data", [])
        assert any((c.get("_id") == centro_id or c.get("id") == centro_id) for c in centros_list), \
            "Created centro de costo not found in the list"

    finally:
        # Cleanup: delete the empresa and cascade delete centros
        del_resp = session.delete(f"{EMPRESAS_URL}/{empresa_id}", headers=headers, timeout=TIMEOUT)
        assert del_resp.status_code in (200, 204), f"Failed to delete empresa in cleanup: {del_resp.text}"


test_create_centro_and_list()