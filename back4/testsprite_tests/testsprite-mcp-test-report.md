
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** back4
- **Date:** 2026-08-03
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

### Requirement: Autorización de PATCH /usuarios/:id/suscripciones
- **Descripción:** Solo `super_admin` y `admin_smartclarity` pueden invocar el endpoint, y únicamente sobre su propio `id` (ownership check `user.sub !== id -> 403`), en ambas direcciones de rol. El rol `usuario` (consumidor) debe ser rechazado incluso sobre su propio id.

#### Test TC017 usuario cannot patch another admin's suscripciones
- **Test Code:** [TC017_usuario_cannot_patch_another_admins_suscripciones.py](./TC017_usuario_cannot_patch_another_admins_suscripciones.py)
- **Status:** ✅ Passed
- **Severity:** N/A
- **Analysis / Findings:** admin_smartclarity logueado recibe `403` al intentar `PATCH` sobre otro admin, y `200` con persistencia correcta sobre su propio id.
---

#### Test TC018 usuario role forbidden from editing suscripciones even for own id
- **Test Code:** [TC018_usuario_role_forbidden_from_editing_suscripciones_even_for_own_id.py](./TC018_usuario_role_forbidden_from_editing_suscripciones_even_for_own_id.py)
- **Status:** ✅ Passed
- **Severity:** N/A
- **Analysis / Findings:** Un usuario con rol `usuario` recibe `403` incluso sobre su propio id — el `@Roles('super_admin', 'admin_smartclarity')` bloquea antes del ownership check.
---

#### Test TC020 super_admin cannot patch admin_smartclarity's suscripciones (ownership symmetry)
- **Test Code:** [TC020_super_admin_cannot_patch_admin_smartclaritys_suscripciones_ownership_symmetry.py](./TC020_super_admin_cannot_patch_admin_smartclaritys_suscripciones_ownership_symmetry.py)
- **Status:** ✅ Passed
- **Severity:** N/A
- **Analysis / Findings:** El ownership check también bloquea en la dirección inversa: un `super_admin` logueado recibe `403` al intentar `PATCH` sobre las suscripciones de otro `admin_smartclarity`, y `200` sobre las propias. Confirma que el check `user.sub !== id` no tiene excepción implícita para `super_admin`.

---

### Requirement: Integridad de la actualización parcial de suscripciones
- **Descripción:** `SuscripcionesDto` marca `empresas_suscritas`/`centros_suscritos`/`proyectos_suscritos` como opcionales, lo que implica semántica PATCH (omitir un campo no debería tocarlo).

#### Test TC019 PATCH suscripciones parcial no debe borrar arrays de suscripcion omitidos del body
- **Test Code:** [TC019_PATCH_suscripciones_parcial_no_debe_borrar_arrays_de_suscripcion_omitidos_del_body.py](./TC019_PATCH_suscripciones_parcial_no_debe_borrar_arrays_de_suscripcion_omitidos_del_body.py)
- **Test Error:** `AssertionError: empresas_suscritas wiped in patch step 2`
- **Status:** ❌ **Failed — bug real confirmado**
- **Severity:** 🟠 Alto
- **Analysis / Findings:** `usuarios.service.ts:actualizarSuscripciones` hace `dto.campo ?? []` para los 3 arrays, así que un segundo `PATCH` que solo envía `centros_suscritos` **borra silenciosamente** `empresas_suscritas` (y `proyectos_suscritos`) a `[]` en vez de conservarlos. El endpoint se comporta como `PUT` (reemplazo total) pese a ser un `@Patch` con campos `@IsOptional`. El frontend actual siempre manda los 3 arrays juntos, por lo que no se dispara en el flujo normal de la UI, pero es un contrato de API roto para cualquier otro caller. Documentado en `back4/tofix.md` #21. Verificado manualmente vía curl antes de generar el test (mismo resultado) y las cuentas de prueba quedaron restauradas a su estado original tras la corrida.
---

#### Test TC021 suscripciones rejects invalid mongo id inside subscription arrays
- **Test Code:** [TC021_suscripciones_rejects_invalid_mongo_id_inside_subscription_arrays.py](./TC021_suscripciones_rejects_invalid_mongo_id_inside_subscription_arrays.py)
- **Status:** ✅ Passed
- **Severity:** N/A
- **Analysis / Findings:** Un `empresas_suscritas` con un valor que no es un ObjectId válido es rechazado con `400` por `class-validator` (`@IsMongoId({each:true})`) antes de llegar al service, y el `GET` posterior confirma que no hubo mutación parcial del estado.

---

## 3️⃣ Coverage & Matching Metrics

- **80% (4/5)** de los tests de esta suite pasaron.

| Requirement                                              | Total Tests | ✅ Passed | ❌ Failed |
|------------------------------------------------------------|-------------|-----------|-----------|
| Autorización PATCH /usuarios/:id/suscripciones              | 3           | 3         | 0         |
| Integridad de la actualización parcial de suscripciones     | 2           | 1         | 1         |

---

## 4️⃣ Key Gaps / Risks

- 🟠 **Bug real encontrado (TC019):** `PATCH /usuarios/:id/suscripciones` reemplaza en vez de fusionar `empresas_suscritas`/`centros_suscritos`/`proyectos_suscritos` — omitir uno de los tres arrays en el body lo borra en vez de dejarlo intacto. No afecta al frontend actual (siempre envía los 3 juntos) pero rompe el contrato implícito de un `@IsOptional` en un DTO de `@Patch`. Ver `back4/tofix.md` #21 para el fix propuesto (merge explícito contra el documento actual, o volver los arrays obligatorios en el DTO).
- 🟢 **Ownership check confirmado simétrico (TC020):** ni `admin_smartclarity` ni `super_admin` pueden editar las suscripciones de otro usuario, sin importar la combinación de roles.
- 🟢 **Validación de arrays confirmada (TC021):** un ID inválido en cualquiera de los arrays de suscripción es rechazado con `400` sin mutar estado, gracias al `ValidationPipe` global (`whitelist + forbidNonWhitelisted + transform`).
- ⚪ **Fuera de alcance de esta suite:** el *efecto* real de las suscripciones sobre el envío de emails (si un admin desuscrito de una empresa específica realmente deja de recibir notificaciones de esa empresa) no es verificable vía TestSprite porque el envío usa Gmail SMTP real, sin bandeja de pruebas inspeccionable por API. Esa cobertura requiere un script tipo `back4/scripts/test-desuscripcion-admin.ts` (Nest ApplicationContext + `MailService` interceptado), no la MCP de TestSprite.
- 🟡 **Hallazgo previo aún pendiente, no cubierto por esta suite:** `notificar_super_admins` (en `solicitudes.service.ts` ×2, `actividades.service.ts`, `clientes.service.ts`, `centros-costos.service.ts`, `proyectos.service.ts`) trae **todos** los `super_admin` activos sin pasar por `condicionSuscripcionAdmin()` — un `super_admin` desuscrito igual recibiría ese correo si el flag está en `true`. No es verificable por TestSprite (mismo motivo que el punto anterior); candidato para el mismo script de verificación directa mencionado arriba.
