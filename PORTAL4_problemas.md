# PORTAL4 — Registro de Problemas Conocidos

Última actualización: 2026-06-01
Rama activa: `feat/restructuracion-rutas`

Leyenda de estado:
- ✅ **SOLUCIONADO** — corregido en esta rama
- ⚠️ **PENDIENTE** — conocido, sin corregir todavía
- 🔴 **CRÍTICO** — riesgo de seguridad o pérdida de datos
- 🟠 **ALTO** — bug que impacta funcionalidad principal
- 🟡 **MEDIO/BAJO** — degradación de UX o calidad de código
- ~~Tachado~~ — obsoleto / ya no aplica

---

## 1. Seguridad

### 1.1 🔴 Cross-tenant: acceso a documentos de otra empresa ✅ SOLUCIONADO (2026-08-12)
**Archivos:** `back4/src/centros-costos/centros-costos.service.ts`, `proyectos.service.ts`

`EmpresaAccessGuard` valida que `empresaId` del URL coincida con el `cliente_id` del JWT, pero **no verificaba que el `centroId`/`proyectoId` perteneciera a esa empresa**. Los servicios hacían `findById(centroId)` sin filtro adicional.

**Vector de ataque:** Usuario de empresa A hacía `GET /empresas/A/centros/<centroId-de-B>/documentos` → recibía documentos de empresa B.

**Solución aplicada:** `centros-costos.service.ts` y `proyectos.service.ts` agregan `autorizarCentro()`/`autorizarProyecto()` — validan `{ _id, cliente_id: empresaId }` (y, para proyectos, que `centroId` esté en `centro_costo_ids`) antes de cualquier lectura/escritura sobre centro, proyecto o sus documentos. Lanzan `NotFoundException` si no calza, mismo criterio que `actividades.service.ts` (`validarPertenencia`). De paso se cerró un segundo hueco relacionado: `centros_asignados` (qué centros ve un usuario `rol: 'usuario'` dentro de su propia empresa) tampoco se filtraba en listados/detalle — ahora `findAllByCliente`/`findOne` lo aplican. Regresión cubierta por `back4/scripts/test-permisos-seguridad.ts` (`npm run test:permisos-seguridad`).

---

### 1.2 🔴 `cambiarPassword`: ownership check con `(req as any)` ⚠️ PENDIENTE
**Archivo:** `back4/src/usuarios/usuarios.controller.ts:46`

La validación de propiedad usa `(req as any).user.sub !== id`. Si el campo `sub` del JWT cambia de nombre (e.g., refactor de `auth.service.ts`), la condición pasa para todos los usuarios — cualquier autenticado podría cambiar la contraseña de otro conociendo su ID.

**Fix:** Tipar `JwtUser` correctamente y verificar que el campo mapeado en `JwtStrategy` sea estable, o mover la validación al service con tipo explícito.

---

### 1.3 🟠 Sin rate limiting en `POST /auth/login` ⚠️ PENDIENTE
**Archivo:** `back4/src/auth/auth.controller.ts`

El endpoint de login no tiene throttling. Vulnerable a ataques de fuerza bruta contra cualquier cuenta.

**Fix:** Instalar `@nestjs/throttler`, registrar `ThrottlerModule` en `app.module.ts`, aplicar `@Throttle(5, 60)` al endpoint de login.

---

### 1.4 🟡 JWT almacenado en `localStorage` ⚠️ PENDIENTE
**Archivo:** `front4/src/app/features/auth/auth.service.ts`

El token se guarda en `localStorage`, accesible desde cualquier script en la página (XSS).

**Fix a largo plazo:** Migrar a cookie `httpOnly; SameSite=Strict` gestionada por el backend. El interceptor ya maneja el 401 automáticamente.

---

### 1.5 🟡 Modo admin/consumidor manipulable desde DevTools ⚠️ PENDIENTE
**Archivo:** `front4/src/app/profile/profile.service.ts`

`profile.mode()` se lee desde `localStorage`. Un usuario puede forzar el modo admin desde la consola del navegador. Las rutas admin están protegidas por `soloAdminGuard` (seguro), pero cualquier lógica UI que dependa únicamente de `profile.mode()` puede ser engañada.

**Fix:** Eliminar el modo del localStorage y derivarlo siempre del rol en el JWT (`rol === 'super_admin'`).

---

### ~~1.6 Path traversal en módulo documentos via `empresa_nombre`/`filename`~~ ✅ OBSOLETO
~~`back4/src/documentos/documentos.service.ts` usaba `path.join()` con parámetros sin sanitizar.~~

El módulo de documentos en filesystem fue **eliminado** en esta rama. Los documentos ahora se almacenan como subdocumentos embebidos en MongoDB (Buffer). No existe ruta de filesystem que sanear.

---

## 2. Bugs funcionales

### 2.1 🔴 `getImagen()` en noticias usa `.lean()` → imágenes rotas ⚠️ PENDIENTE
**Archivo:** `back4/src/noticias/noticias.service.ts`

El método `getImagen()` llama `.lean()`, por lo que MongoDB retorna `imagen_data` como un objeto BSON Binary en vez de un `Buffer` nativo. `res.send()` lo serializa como JSON, enviando `{"_bsontype":"Binary",...}` al cliente con `Content-Type: image/*`. Todas las imágenes de noticias se renderizan como texto roto.

**Fix:** Eliminar `.lean()` en `getImagen()` (igual que hacen `servirDocumento` en mantenciones y solicitudes).

---

### 2.2 🟠 `notificarRechazoSolicitud` no notifica a super_admins ⚠️ PENDIENTE
**Archivo:** `back4/src/solicitudes/solicitudes.service.ts:106`

`notificarRechazoSolicitud` consulta solo `{ cliente_id: empresaId, rol: admin_cliente | centros_asignados }`. Los super_admins (sin `cliente_id`) nunca aparecen. Reciben emails de creación de solicitud pero no de rechazo.

**Fix:** Añadir la misma query de `superAdmins` que existe en `notificarUsuariosCentro` y hacer merge con deduplicación.

---

### 2.3 🟠 Filtro de categorías en documentos sin efecto (código muerto) ⚠️ PENDIENTE
**Archivos:** `front4/.../documentos-admin-page.component.ts:204`, `documentos-consumidor-page.component.ts`

`docsFiltrados(tipo)` devuelve la lista completa sin consultar `panels[tipo].filtrosCategorias`. Los toggles de categoría están cableados a estado pero ese estado nunca se aplica. Afecta tanto al panel admin como al consumidor.

**Fix:** En `docsFiltrados(tipo)`, filtrar por `panels[tipo].filtrosCategorias` si el array tiene elementos.

---

### 2.4 🟠 `GET /empresas` no puede listar empresas desactivadas ⚠️ PENDIENTE
**Archivo:** `back4/src/clientes/clientes.controller.ts:24`

El controller llama `clientesService.findAll(page, limit)` sin pasar `soloActivos`, que usa `true` como default. El parámetro `?activos=false` fue eliminado del controller. Las empresas con soft-delete son irrecuperables desde la UI.

**Fix:** Añadir `@Query('activos') activos = 'true'` al controller y pasar `activos !== 'false'` al service.

---

### 2.5 🟡 `scoreDeProyecto()` es método ordinario en template ⚠️ PENDIENTE
**Archivo:** `front4/.../mis-proyectos-page.component.ts:93`

El método se llama directamente en el template (`scoreDeProyecto(proyecto._id)`), lo que provoca un recalculo completo en cada ciclo de change detection. Si el listado crece, esto degrada el rendimiento visiblemente.

**Fix:** Convertir a `computed` o pre-calcular un `Map<id, score>` en un signal.

---

### 2.6 🟡 `effect()` sin cleanup en documentos-consumidor-page ⚠️ PENDIENTE
**Archivo:** `front4/.../documentos-consumidor-page.component.ts`

Los efectos angulares no inyectan `DestroyRef`, lo que puede provocar memory leaks si el componente es destruido y recreado repetidamente.

**Fix:** Inyectar `DestroyRef` y pasarlo como opción a `effect()`.

---

### 2.7 ✅ `eliminar()` en DocumentosService parseaba IDs del URL con regex — SOLUCIONADO
**Archivo:** `front4/src/app/features/documentos/documentos.service.ts`

~~Tras borrar un documento, el service extraía `empresaId`/`centroId`/`proyectoId` del URL con tres regex. Si la estructura cambiaba, los match devolvían `undefined` y la recarga se omitía silenciosamente.~~

**Solución aplicada:** Cambiada la firma de `eliminar()` a `eliminar(docUrl, tipo, empresaId, centroId?, proyectoId?)`. Los dos componentes (`documentos-admin-page` y `documentos-consumidor-page`) pasan los IDs que ya tienen en su estado local. Se elimina el parsing por regex.

---

## 3. Fiabilidad y diseño

### 3.1 🟠 FK `@IsOptional` + aserción `!` en servicios → TypeError si se bypasea ⚠️ PENDIENTE
**Archivos:** `back4/src/centros-costos/centros-costos.dto.ts`, `proyectos.dto.ts`

`cliente_id`, `centro_costo_id` y `empresa_id` son `@IsOptional()` en los DTOs (para que el body no sea rechazado cuando vienen del route param). El servicio los usa con `!` (`dto.cliente_id!`). Si cualquier caller envía el body sin esos campos (class-validator lo acepta), `new Types.ObjectId(undefined)` lanza un `BSONTypeError` no capturado.

**Fix:** Usar DTOs separados para el body (sin los FK) y para el servicio (con los FK requeridos), combinándolos en el controller, o añadir validación explícita en el servicio.

---

### 3.2 🟡 `DocumentosHelper.agregar()` puede retornar metadatos del documento equivocado ⚠️ PENDIENTE
**Archivo:** `back4/src/common/helpers/documentos.helper.ts:47`

Retorna `doc.documentos[doc.documentos.length - 1]` tras el `$push`. Bajo uploads concurrentes al mismo recurso, el array puede tener más de un documento nuevo y `[length-1]` puede ser el de otra request.

**Fix:** Retornar el subdocumento por `_id` usando `$push` con `$each` y un `arrayFilters`, o hacer un segundo query por el `nombre` único generado.

---

### 3.3 ✅ `noticias.create()` bloqueaba la respuesta HTTP hasta enviar emails a todos los usuarios — SOLUCIONADO
**Archivo:** `back4/src/noticias/noticias.service.ts`

~~`create()` hacía `await notificarTodosLosUsuarios(noticia)` antes de retornar, bloqueando la respuesta.~~

**Solución aplicada:** Cambiado a `void this.notificarTodosLosUsuarios(noticia)` — fire-and-forget. La notificación se dispara sin bloquear; los errores siguen siendo capturados por el try/catch interno y logueados.

> ⚠️ **Pendiente complementario:** el scope de destinatarios sigue siendo todos los usuarios activos sin filtro de empresa. Considerar acotar por empresa/rol relevante.

---

## 4. Problemas solucionados en esta sesión

| # | Problema | Archivo | Commit |
|---|----------|---------|--------|
| ✅ | `GET /usuarios` exponía todos los usuarios a cualquier autenticado | `usuarios.controller.ts` | feat/restructuracion-rutas |
| ✅ | `environment.prod.ts` apuntaba a `localhost:3000` silenciosamente en builds de prod | `scripts/set-env.js` | feat/restructuracion-rutas |
| ✅ | Interceptor sin manejo de 401 → token expirado no redirigía a login | `auth.interceptor.ts` | feat/restructuracion-rutas |
| ✅ | Lógica de calendario duplicada (~94 líneas) entre dos componentes con divergencia sutil | `calendar-state.ts` (nuevo) | feat/restructuracion-rutas |
| ✅ | Métodos `agregarDocumento/listarDocumentos/servirDocumento/eliminarDocumento` duplicados en 3 servicios | `common/helpers/documentos.helper.ts` (nuevo) | feat/restructuracion-rutas |
| ✅ | Frontend de mantenciones y solicitudes no manejaba formato paginado `{data, total}` | `mantenciones.service.ts`, `solicitudes.service.ts` | feat/restructuracion-rutas |
| ✅ | Path traversal en módulo documentos vía `empresa_nombre`/`filename` (filesystem) | Módulo eliminado; documentos migrados a MongoDB | feat/restructuracion-rutas |

---

## 5. Referencias

- `back4/CLAUDE.md` — guía de arquitectura y convenciones del backend
- `front4/CLAUDE.md` — guía de arquitectura y convenciones del frontend
- `DEPLOY.md` — instrucciones de despliegue
