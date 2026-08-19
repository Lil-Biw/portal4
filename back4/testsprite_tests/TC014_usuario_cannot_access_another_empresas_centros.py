import requests

BASE_URL = "http://localhost:3000/api/v1"
TIMEOUT = 30

def test_usuario_cannot_access_other_empresa_centros():
    usuario_email = "rodrigo.fuentes@cordillera.cl"
    usuario_password = "Demo1234!"
    superadmin_email = "superadmin@eclariti.local"
    superadmin_password = "Demo1234!"

    session = requests.Session()

    try:
        # 1) Login as usuario (Cordillera)
        resp = session.post(
            f"{BASE_URL}/auth/login",
            json={"email": usuario_email, "password": usuario_password},
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200, f"Failed login usuario: {resp.text}"
        usuario_token = resp.json().get("access_token")
        assert usuario_token, "No access_token received for usuario"

        usuario_headers = {"Authorization": f"Bearer {usuario_token}"}

        # 2) Login as super_admin to get empresas
        resp = session.post(
            f"{BASE_URL}/auth/login",
            json={"email": superadmin_email, "password": superadmin_password},
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200, f"Failed login super_admin: {resp.text}"
        superadmin_token = resp.json().get("access_token")
        assert superadmin_token, "No access_token received for super_admin"
        superadmin_headers = {"Authorization": f"Bearer {superadmin_token}"}

        resp = session.get(f"{BASE_URL}/empresas", headers=superadmin_headers, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Failed to get empresas: {resp.text}"
        data = resp.json()
        assert isinstance(data, dict), "Empresas response is not an object"
        assert "data" in data and isinstance(data["data"], list), "Empresas response missing 'data' list"

        empresas = data["data"]
        assert len(empresas) > 0, "No empresas found"

        # Find the empresa named "AgroSur Ltda."
        agro_sur_empresa = None
        for empresa in empresas:
            razon_social = empresa.get("razon_social") or empresa.get("nombre")  # fallback if 'razon_social' absent
            if razon_social and "AgroSur" in razon_social:
                agro_sur_empresa = empresa
                break

        assert agro_sur_empresa is not None, "Empresa 'AgroSur Ltda.' not found in empresas list"

        agro_sur_id = agro_sur_empresa.get("_id")
        assert agro_sur_id, "Empresa 'AgroSur Ltda.' has no _id"

        # 3) Using usuario JWT (Cordillera), attempt to access AgroSur centros
        resp = session.get(
            f"{BASE_URL}/empresas/{agro_sur_id}/centros",
            headers=usuario_headers,
            timeout=TIMEOUT,
        )

        # Verify response is 403 Forbidden
        assert resp.status_code == 403, f"Expected 403 Forbidden, got {resp.status_code}: {resp.text}"

    finally:
        session.close()

test_usuario_cannot_access_other_empresa_centros()