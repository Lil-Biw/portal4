import requests
import random
import string

BASE_URL = "http://localhost:3000/api/v1"
TIMEOUT = 30

SUPER_ADMIN_CREDENTIALS = {"email": "superadmin@eclariti.local", "password": "Demo1234!"}
USUARIO_CREDENTIALS = {"email": "jose.perez@agrosur.cl", "password": "Demo1234!"}

def login(email, password):
    url = f"{BASE_URL}/auth/login"
    resp = requests.post(url, json={"email": email, "password": password}, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    assert "access_token" in data
    assert "usuario" in data
    return data["access_token"], data["usuario"]

def test_tc011_create_noticia_as_super_admin_and_access_it():
    # Login as super_admin
    token_sa, user_sa = login(**SUPER_ADMIN_CREDENTIALS)
    headers_sa = {"Authorization": f"Bearer {token_sa}"}

    # POST /api/v1/noticias with valid titulo and contenido (using correct fields: titulo, resumen, enlace, seccion)
    noticia_payload = {
        "titulo": "Test Noticia " + ''.join(random.choices(string.ascii_letters + string.digits, k=6)),
        "resumen": "Resumen para la noticia creada en test.",
        "enlace": "https://ejemplo.cl/noticia/test-noticia",
        "seccion": "novedades"
    }
    resp_post = requests.post(f"{BASE_URL}/noticias", json=noticia_payload, headers=headers_sa, timeout=TIMEOUT)
    assert resp_post.status_code in (200, 201), f"Expected 200 or 201 but got {resp_post.status_code}: {resp_post.text}"
    noticia = resp_post.json()
    assert "id" in noticia or "_id" in noticia or "noticia" in noticia, "Response does not contain noticia id"
    # Adapt id extraction
    noticia_id = noticia.get("id") or noticia.get("_id") or (noticia.get("noticia") and noticia["noticia"].get("id")) or (noticia.get("noticia") and noticia["noticia"].get("_id"))
    assert noticia_id is not None

    try:
        # GET /api/v1/noticias/:id to verify retrievable
        resp_get = requests.get(f"{BASE_URL}/noticias/{noticia_id}", headers=headers_sa, timeout=TIMEOUT)
        assert resp_get.status_code == 200, f"Expected 200 but got {resp_get.status_code} on GET noticia"
        noticia_get = resp_get.json()
        # Validate fields match what was created
        assert noticia_get.get("titulo") == noticia_payload["titulo"]
        assert noticia_get.get("resumen") == noticia_payload["resumen"]
        assert noticia_get.get("enlace") == noticia_payload["enlace"]
        assert noticia_get.get("seccion") == noticia_payload["seccion"]

        # Login as usuario without super_admin role
        token_usr, user_usr = login(**USUARIO_CREDENTIALS)
        headers_usr = {"Authorization": f"Bearer {token_usr}"}

        # Try POST /api/v1/noticias as normal usuario
        noticia_payload2 = {
            "titulo": "Noticia Usuario " + ''.join(random.choices(string.ascii_letters + string.digits, k=6)),
            "resumen": "Resumen para intento no autorizado.",
            "enlace": "https://ejemplo.cl/noticia/usuario-intento",
            "seccion": "novedades"
        }
        resp_post_usr = requests.post(f"{BASE_URL}/noticias", json=noticia_payload2, headers=headers_usr, timeout=TIMEOUT)
        assert resp_post_usr.status_code == 403, f"Expected 403 forbidden but got {resp_post_usr.status_code} for non-super_admin notice creation"

    finally:
        # Cleanup: delete the created noticia as super_admin
        if noticia_id:
            resp_delete = requests.delete(f"{BASE_URL}/noticias/{noticia_id}", headers=headers_sa, timeout=TIMEOUT)
            assert resp_delete.status_code in (200, 204), f"Expected 200 or 204 deleting noticia but got {resp_delete.status_code}"

test_tc011_create_noticia_as_super_admin_and_access_it()