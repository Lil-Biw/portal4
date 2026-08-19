import requests
import random
import string
import time

BASE_URL = "http://localhost:3000/api/v1"
SUPERADMIN_EMAIL = "superadmin@eclariti.local"
SUPERADMIN_PASSWORD = "Demo1234!"
TIMEOUT = 30


def random_string(length=6):
    return ''.join(random.choices(string.ascii_letters, k=length))


def random_rut_suffix():
    # Generate a random numeric suffix of 6 digits to ensure uniqueness
    return str(random.randint(100000, 999999))


def login(email, password):
    url = f"{BASE_URL}/auth/login"
    payload = {
        "email": email,
        "password": password
    }
    response = requests.post(url, json=payload, timeout=TIMEOUT)
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    token = data.get("access_token")
    assert token and isinstance(token, str)
    return token


def get_tipos_activo(token):
    url = f"{BASE_URL}/tipos-activo"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers, timeout=TIMEOUT)
    assert response.status_code == 200, f"Failed to get tipos-activo: {response.text}"
    tipos = response.json()
    return tipos


def create_tipo_activo(token, nombre):
    url = f"{BASE_URL}/tipos-activo"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"nombre": nombre}
    response = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)
    assert response.status_code in (200, 201), f"Failed to create tipo-activo: {response.text}"
    tipo = response.json()
    assert "_id" in tipo or "id" in tipo
    return tipo.get("_id") or tipo.get("id")


def create_empresa(token):
    url = f"{BASE_URL}/empresas"
    suffix = random_rut_suffix()
    razon_social = f"TestEmpresa{random_string(4)}"
    rut = f"12345678-{suffix}"
    email_contacto = f"testemail{suffix}@example.com"
    payload = {
        "razon_social": razon_social,
        "rut": rut,
        "email_contacto": email_contacto
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)
    assert response.status_code in (200, 201), f"Failed to create empresa: {response.text}"
    empresa = response.json()
    empresa_id = empresa.get("_id") or empresa.get("id")
    assert empresa_id
    return empresa_id


def delete_empresa(token, empresa_id):
    url = f"{BASE_URL}/empresas/{empresa_id}"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.delete(url, headers=headers, timeout=TIMEOUT)
    # deletion may return 200 or 204 or 202 depending on API design
    assert response.status_code in (200, 202, 204), f"Failed to delete empresa: {response.text}"


def create_centro(token, empresa_id):
    url = f"{BASE_URL}/empresas/{empresa_id}/centros"
    codigo = f"C{random_string(3)}"
    nombre = f"Centro {random_string(5)}"
    payload = {"codigo": codigo, "nombre": nombre}
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)
    assert response.status_code in (200, 201), f"Failed to create centro: {response.text}"
    centro = response.json()
    centro_id = centro.get("_id") or centro.get("id")
    assert centro_id
    return centro_id


def delete_centro(token, empresa_id, centro_id):
    url = f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.delete(url, headers=headers, timeout=TIMEOUT)
    assert response.status_code in (200, 202, 204), f"Failed to delete centro: {response.text}"


def create_activo(token, empresa_id, centro_id, tipo_activo_id):
    url = f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}/activos"
    nombre = f"Activo {random_string(5)}"
    payload = {
        "nombre": nombre,
        "tipo_activo_id": tipo_activo_id
    }
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)
    assert response.status_code in (200, 201), f"Failed to create activo: {response.text}"
    activo = response.json()
    activo_id = activo.get("_id") or activo.get("id")
    assert activo_id
    return activo_id


def delete_activo(token, empresa_id, centro_id, activo_id):
    url = f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}/activos/{activo_id}"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.delete(url, headers=headers, timeout=TIMEOUT)
    assert response.status_code in (200, 202, 204), f"Failed to delete activo: {response.text}"


def get_historial(token, empresa_id, centro_id, activo_id):
    url = f"{BASE_URL}/empresas/{empresa_id}/centros/{centro_id}/activos/{activo_id}/historial"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers, timeout=TIMEOUT)
    return response


def test_TC008_create_activo_under_centro_and_check_historial():
    token = login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)

    empresa_id = None
    centro_id = None
    activo_id = None

    try:
        # Create empresa
        empresa_id = create_empresa(token)

        # Create centro under empresa
        centro_id = create_centro(token, empresa_id)

        # Get tipos-activo list
        tipos_activo = get_tipos_activo(token)
        if tipos_activo and isinstance(tipos_activo, list) and len(tipos_activo) > 0:
            tipo_activo_id = tipos_activo[0].get("_id") or tipos_activo[0].get("id")
        else:
            # create tipo-activo if none exist
            tipo_activo_id = create_tipo_activo(token, f"TipoActivo{random_string(4)}")

        # Create activo under empresa and centro
        activo_id = create_activo(token, empresa_id, centro_id, tipo_activo_id)

        # GET historial for the activo
        response = get_historial(token, empresa_id, centro_id, activo_id)

        assert response.status_code == 200, f"Historial GET failed: {response.status_code} {response.text}"
        historial_data = response.json()
        assert isinstance(historial_data, list), "Historial response is not an array"

    finally:
        # Cleanup created activo
        if activo_id and centro_id and empresa_id:
            try:
                delete_activo(token, empresa_id, centro_id, activo_id)
            except Exception:
                pass

        # Cleanup created centro
        if centro_id and empresa_id:
            try:
                delete_centro(token, empresa_id, centro_id)
            except Exception:
                pass

        # Cleanup created empresa
        if empresa_id:
            try:
                delete_empresa(token, empresa_id)
            except Exception:
                pass


test_TC008_create_activo_under_centro_and_check_historial()