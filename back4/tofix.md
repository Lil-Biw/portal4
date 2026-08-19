# tofix — Backend

Problemas verificados contra el código el 2026-07-06 (rama `feat/restructuracion-rutas`).
Incluye la revisión de seguridad previa + revisión senior de flujos, lógica y código repetido,
más una revisión enfocada en el guardado de documentos adjuntos de solicitudes.

Leyenda: 🔴 crítico · 🟠 alto · 🟡 medio/bajo · 🔵 limpieza

---

## Bugs y seguridad

### 🔴 1. Cross-tenant: IDs anidados no se validan contra la empresa

**Archivos:** `src/centros-costos/centros-costos.service.ts`, `src/proyectos/proyectos.service.ts`, `src/actividades/actividades.service.ts`, `src/activos/`

`EmpresaAccessGuard` valida que el `:empresaId` del URL coincida con el `cliente_id` del JWT,
pero los servicios hacen `findById(centroId | proyectoId | actividadId)` sin verificar que la
entidad pertenezca a esa empresa. `DocumentosHelper.listar/servir/eliminar` tampoco reciben
el `empresaId`.

**Vector:** usuario de empresa A llama `GET /empresas/A/centros/<centroId-de-B>/documentos`
→ pasa el guard y recibe datos de B. `ActividadesService.findOne()` ignora `empresaId`/`centroId`.

**Fix:** buscar filtrando por pertenencia (`{ _id: centroId, cliente_id: empresaId }`) o pasar
`empresaId` al `DocumentosHelper` y validar ahí.

Ver también **#2**: en `solicitudes.service.ts` el mismo patrón es más grave porque permite
**escritura y borrado** cruzados, no solo lectura.

---

### 🔴 2. Cross-tenant de escritura: ninguna mutación de solicitudes valida la empresa

**Archivo:** `src/solicitudes/solicitudes.service.ts` (`update`, `remove`, `cambiarEstado`, `adjuntarArchivo`, `servirAdjunto`)

Los 5 métodos hacen `findById(id)` / `findByIdAndUpdate(id, ...)` **sin filtrar por `empresa_id`**.
`EmpresaAccessGuard` solo verifica que el `:empresaId` de la URL coincida con el `cliente_id` del
usuario — nunca que el `:solicitudId` pertenezca a esa empresa.

**Vector:** un usuario de la empresa A que conozca (o adivine) el ObjectId de una solicitud de la
empresa B puede, usando su propio `empresaId` en la URL para pasar el guard:
- `PATCH /empresas/A/solicitudes/<idDeB>` — editar nombre/tipo/descripción de la solicitud de B.
- `DELETE /empresas/A/solicitudes/<idDeB>` — eliminarla.
- `PUT /empresas/A/solicitudes/<idDeB>/estado` — **aprobarla**, lo que dispara `crearDocumentoDesde()`
  y copia el adjunto de B a los documentos oficiales de B con datos manipulados por A.
- `POST /empresas/A/solicitudes/<idDeB>/adjuntar` — reemplazar el archivo adjunto de B (y borrar el
  original de S3 vía la limpieza de `keyAnterior`).
- `GET /empresas/A/solicitudes/<idDeB>/adjunto` — descargar el archivo adjunto de B.

Es estrictamente peor que #1 (que es de solo lectura): acá hay edición, borrado y suplantación de
aprobación entre empresas distintas.

**Fix:** agregar `empresa_id: new Types.ObjectId(empresaId)` al filtro de cada método (pasando
`empresaId` desde el controller, que ya lo tiene como route param) — p. ej.
`findOneAndUpdate({ _id: id, empresa_id: empresaId }, ...)`.

---

### 🔴 3. Sin `@Roles()` en el flujo de aprobación/edición de solicitudes

**Archivo:** `src/solicitudes/solicitudes.controller.ts` (`create`, `update`, `remove`, `cambiarEstado`)

Ninguno de estos 4 endpoints tiene `@Roles()`. Según `RolesGuard` ("si no hay `@Roles()`, permite
el acceso"), cualquier usuario autenticado con rol `usuario` (consumidor) y `cliente_id` correcto
puede llamar directamente `PUT /empresas/:id/solicitudes/:sid/estado` con `{ estado: 'aprobado' }`
— **auto-aprobando su propia solicitud sin revisión de un admin**, que es la razón de ser de todo
el flujo. También puede editarla (`update`) o borrarla (`remove`) sin pasar por el panel admin.
Combinado con #2, además puede hacerlo sobre solicitudes de **otra** empresa.

En el frontend estas acciones solo están expuestas en `documentos-admin-page` (visible solo en modo
admin), pero eso no protege la API — es responsabilidad del backend, no de la UI.

**Fix:** agregar `@Roles('super_admin', 'admin_smartclarity')` a `create`, `update`, `remove` y
`cambiarEstado`. Dejar sin restricción `findAll`, `adjuntar` y `servirAdjunto`, que sí son
operaciones legítimas del consumidor.

---

### 🔴 4. `vencerDocumento` de empresa pierde el `s3_key`

**Archivo:** `src/clientes/clientes.service.ts` (~línea 165, llamada a `documentosVencidosService.crear`)

Al vencer un documento de **empresa** se copian `contenido`, metadata, etc., pero **no `s3_key`**
(las versiones de centros y proyectos sí lo copian). Todo documento de empresa subido post-migración
a S3 tiene `s3_key` y `contenido` vacío → el documento vencido queda sin archivo: descargarlo
revienta en `Buffer.from(undefined.buffer)`.

**Fix:** añadir `s3_key: doc.s3_key` al objeto que se pasa a `crear()` (una línea). Evaluar migración
de los vencidos de empresa ya rotos.

---

### 🟠 5. Sin rate limiting en `POST /auth/login`

`@nestjs/throttler` no está instalado. Vulnerable a fuerza bruta.
**Fix:** `ThrottlerModule` + `@Throttle` en login.

---

### 🟠 6. `GET /clientes` no puede listar empresas desactivadas

`ClientesService.findAll(page, limit, soloActivos = true)` acepta el flag pero el controller nunca
lo pasa → las empresas con soft-delete son irrecuperables desde la UI.
**Fix:** `@Query('activos')` en el controller (solo super_admin).

---

### 🟠 7. FK `@IsOptional` en DTOs + aserción `!` en servicios

**Archivos:** `centros-costos.dto.ts`, `proyectos.dto.ts`, `solicitudes.dto.ts` y sus services

`cliente_id`/`centro_costo_id`/`empresa_id` son opcionales en el DTO (vienen del route param) pero el
service los usa con `!`. Si un caller llega sin ellos, `new Types.ObjectId(undefined)` → 500.
**Fix:** validación explícita en el service o DTOs separados body/servicio.

---

### 🟡 8. Filtro `centroCostoId` en `findAllByEmpresa` amplía en vez de acotar

**Archivos:** `src/actividades/actividades.service.ts:44-53`, `src/activos/activos.service.ts:53-61`

Cuando llega `centroCostoId`, el filtro queda `{ $in: [...todosLosCentrosDeLaEmpresa, centroId] }`
— un superconjunto: no filtra nada. Hoy es código muerto (el frontend nunca envía ese parámetro a
las rutas de empresa), pero quien lo use esperando acotar recibirá todo.
**Fix:** decidir la semántica — si es "solo ese centro", usar `{ $in: [centroId] }` validando que
pertenezca a la empresa; si no se necesita, eliminar el parámetro. El `$in` con string + ObjectId
en `activos.findAll` sugiere además datos legacy con `centro_costo_id` guardado como string — migrar.

---

### 🟡 9. Enum de estados de solicitud desalineado con el frontend

`solicitudes.schema.ts` y `CambiarEstadoDto` aceptan `['pendiente','revision','aprobado','rechazado']`;
el frontend además usa `'vencido'` (tipo, chips, transiciones en documentos-admin, y el botón
"Adjuntar fuera de plazo" en documentos-consumidor). Como el backend nunca asigna `'vencido'` a una
solicitud (no existe en el enum ni hay código que lo setee), esa rama del frontend es efectivamente
inalcanzable hoy — pero si se guardara manualmente en Mongo, `adjuntarArchivo()` la rechazaría con
400 porque solo acepta `['pendiente','rechazado']`.
**Fix:** agregar el estado al schema/DTO (y a la whitelist de `adjuntarArchivo`) si se va a usar de
verdad, o quitarlo del frontend (ver `front4/tofix.md` §3).

---

### 🟡 10. `(req as any).user` en controllers

`usuarios.controller.ts` (en `cambiarPassword` ni siquiera con cast a `JwtUser`), `clientes.controller.ts`,
`centros-costos.controller.ts`. Si `sub` cambia de nombre en la strategy, los ownership checks pasan en silencio.
**Fix:** decorador `@UsuarioActual()` tipado.

---

### 🟡 11. `usuarios.update` no normaliza ni valida email

`create()` hace lowercase + chequeo de duplicado; `update()`/`updateByCliente()` aceptan `email` sin
normalizar ni verificar unicidad → puede quedar `Foo@X.com` duplicado que luego no matchea el login.
**Fix:** replicar la normalización/validación de `create()` en update.

---

### 🟡 12. Notificación de noticias atada a la subida de imagen

`noticias.service.ts`: `create()` no notifica; `subirImagen()` notifica a **todos los usuarios
activos** cada vez que se sube/reemplaza la imagen. Reemplazar la imagen re-spamea a todo el sistema
y una noticia sin imagen no se anuncia nunca. Además sigue sin filtro por empresa/rol.
**Fix:** mover la notificación a `create()` (o a un endpoint explícito "publicar") y acotar destinatarios.

---

### 🟡 13. Objetos huérfanos en S3 (sin purga)

Papelera (`doc_eliminados`) y vencidos (`documentos_vencidos`) solo copian la referencia `s3_key`;
nada borra los objetos de S3 (salvo el reemplazo de adjunto de solicitud, que sí limpia).
**Fix:** política de retención + job de limpieza o lifecycle rule.

---

## Flujos y latencia

### 🟠 14. Aprobar una solicitud falla en silencio si no se puede copiar el adjunto

**Archivo:** `src/solicitudes/solicitudes.service.ts` → `cambiarEstado()`

```ts
if (dto.estado === 'aprobado' && estadoPrevio.estado !== 'aprobado') {
  const solFull = await this.solicitudModel.findById(id);
  if (solFull?.adjunto?.s3_key || solFull?.adjunto?.contenido) {
    await this.crearDocumentoDesde(solFull).catch(err =>
      this.logger.error('Error al crear documento desde solicitud aprobada:', err)
    );
  }
}
return solicitud;
```

Si `crearDocumentoDesde()` falla (S3 caído, `s3.descargar()` no encuentra el objeto, el
centro/proyecto destino fue eliminado entre medio, etc.), el error se traga con `.catch()` y el
endpoint igual responde 200 con la solicitud en estado `aprobado`. El admin ve "Estado actualizado a
Aprobado" y no hay ninguna señal de que el documento **no** se guardó en la colección `doc_*` — solo
queda un log en el servidor. No hay reintento ni forma de detectarlo desde la UI.

**Fix:** al menos devolver una advertencia en la respuesta (ej. `{ ...solicitud, documento_creado: false }`)
para que el frontend pueda mostrarla, o no capturar el error y dejar que la aprobación falle si el
documento no pudo crearse (más estricto, pero evita el estado inconsistente).

---

### 🟡 15. Los `create()` esperan el envío de correos antes de responder

`solicitudes.create()` y `actividades.create()` hacen `await notificar...()` — la respuesta HTTP
queda bloqueada por el SMTP de Gmail (puede ser varios segundos con N destinatarios). Noticias y
documentos ya usan fire-and-forget (`void ...catch`).
**Fix:** unificar a fire-and-forget con try/catch interno (el patrón ya existe en el propio repo).

---

### ✅ ~~16. `new Types.ObjectId(param)` sin validar → 500 en vez de 400~~ — **SOLUCIONADO**

Patrón generalizado (services y helper). Algunos métodos sí validan (`documentos-vencidos`,
`actividades.findByActivo` con try/catch), el resto no — un ID malformado en la URL producía
`CastError`/`BSONError` sin capturar (ej. `GET /usuarios/1000` → 500).
**Fix aplicado:** `ParseObjectIdPipe` (`src/common/pipes/parse-object-id.pipe.ts`) registrado
globalmente en `main.ts`. Valida cualquier `@Param` cuyo nombre sea `id` o termine en `Id`
(cubre los 115 usos existentes en todos los controllers) y lanza `BadRequestException` (400)
si el valor no es un ObjectId válido, antes de que llegue al service. No toca `@Body`/`@Query`
ni params que no tengan forma de ObjectId. Test: `npm run test:parse-object-id-pipe`.
**Nota de compatibilidad:** rutas que ya se defendían manualmente (`documentos.helper.ts`,
`documentos-vencidos.service.ts`, `actividades.findByActivo`) devolvían 404 para un id
malformado en el path; ahora el pipe corta antes y devuelve 400. Es el código de estado
correcto (malformado ≠ no encontrado), pero es un cambio de contrato — no se detectó ningún
`front4` dependiendo del 404 en esos casos.

---

## Código repetido

### ✅ ~~17. Bloque "resolver destinatarios de notificación" duplicado 6 veces~~ — **SOLUCIONADO**

**Archivos:** `solicitudes.service.ts` (×2: nueva y rechazo), `actividades.service.ts`,
`clientes.service.ts`, `centros-costos.service.ts`, `proyectos.service.ts`

~50 líneas casi idénticas por copia: audiencia `especificos`/`todos` + `$or` con `admin_smartclarity`
+ super_admins opcionales + dedup por email. Ya divergieron (clientes no filtra por rol en `todos`,
solicitudes trata `notificacion undefined` como notificar y los vencimientos como no notificar).

Esta duplicación era la causa raíz de un bug reportado ("me desuscribo y sigo recibiendo mails"):
las 6 ramas de audiencia `'todos'` incluían `{ rol: 'admin_smartclarity' }` sin condición alguna,
ignorando por completo `notificar_todas_empresas`/`empresas_suscritas`/`centros_suscritos`/
`proyectos_suscritos` del admin. Se extrajo `condicionSuscripcionAdmin()` a
`common/helpers/notificar-documento.helper.ts` (reutilizada también por `resolverAdminsSuscritos`)
y se aplicó en los 6 puntos para que el admin_smartclarity solo entre al `$or` si sigue suscrito.
Test de regresión: `back4/scripts/test-desuscripcion-admin.ts` (`npm run test:desuscripcion`).

**2026-08-03 — el 7mo punto (`especificos`) también se arregló.** El supuesto original ("ahí el
destinatario admin_smartclarity se elige a mano por ID, no es un broadcast que deba respetar la
suscripción") no se sostenía en la práctica: en `actividades-page.component.ts` (front4), el wizard
de crear/editar actividad preseleccionaba **todos** los admins como destinatarios por defecto
(`resetNotif()`, `patchForm('empresa_id')`), sin que el operador tocara nada — es decir, el
`destinatarios_ids` que llega al backend no representa necesariamente una elección manual real. Un
admin desuscrito de todo quedaba marcado en la UI sin ningún indicador y, si el operador destildaba
a cualquier otro destinatario (forzando `audiencia: 'especificos'` en vez de `'todos'`), efectivamente
recibía el mail pese a estar desuscrito.

Fix en dos capas:
- **Frontend:** `resetNotif()` y `patchForm('empresa_id')` ahora preseleccionan solo
  `adminsSuscritosIds()` (admins suscritos), no todos los admins. Un admin desuscrito ya no aparece
  marcado por defecto.
- **Backend (defensa en profundidad):** la rama `especificos` de `notificarUsuariosCentro`
  (`actividades.service.ts`) ahora aplica `condicionSuscripcionAdmin(...)` al `admin_smartclarity`
  del `$or`, igual que la rama `'todos'` — aunque llegue el ID de un admin desuscrito en
  `destinatarios_ids` (por ejemplo por un bug futuro similar en el front, o por otro caller), no se
  le envía el mail.

La duplicación del resto del bloque (branch `especificos`, dedup por email, super_admins opcionales)
en los otros módulos sigue pendiente de extraer a un helper común.

---

### 🟠 18. `vencerDocumento` + `notificarVencimiento` duplicados 3 veces

`clientes`, `centros-costos` y `proyectos` repiten el mismo flujo (~80 líneas c/u): find entidad →
find doc → `documentosVencidosService.crear` → `deleteOne` → notificar. La divergencia ya produjo
el bug #4 (s3_key perdido solo en clientes).
**Fix:** mover el flujo a `DocumentosVencidosService.vencerDesde(docModel, filtro, contexto)` o al
`DocumentosHelper`, parametrizando `origen_tipo`.

---

### 🟡 19. Normalización de Buffer BSON duplicada 4 veces

`noticias.getImagen`, `clientes.servirLogo`, `solicitudes.crearDocumentoDesde`/`servirAdjunto`,
`documentos.helper.servir`, `documentos-vencidos.descargar` — cada uno reimplementa el
`isBuffer / 'buffer' in raw / Buffer.from(...)`, con variantes (algunas no cubren el caso
`{ buffer: ... }`).
**Fix:** util `toBuffer(raw: unknown): Buffer` en `common/helpers` y usarlo en todos.

---

### 🟡 20. Tipo inline de Usuario y `Model<any>` repetidos

El literal `Model<{ nombre; email; rol; cliente_id; centros_asignados; activo }>` está copiado en
6 constructores; los modelos `doc_*` se inyectan como `Model<any>`; `toObjectId()` privado repetido
en 4 services.
**Fix:** exportar `UsuarioLean`/interfaces de docs desde los schemas y un util compartido; alinea con
la convención "sin any" del propio CLAUDE.md.

---

### 🟠 21. `PATCH /usuarios/:id/suscripciones` reemplaza en vez de fusionar los arrays

**Archivo:** `src/usuarios/usuarios.service.ts` (`actualizarSuscripciones`, ~línea 240)

Encontrado y confirmado (manual + TestSprite `TC019`, 2026-08-03). El endpoint es un `@Patch` y
`SuscripcionesDto` marca `empresas_suscritas`/`centros_suscritos`/`proyectos_suscritos` como
`@IsOptional()`, lo que sugiere semántica de actualización parcial (omitir un campo = no tocarlo).
Pero el service hace:

```ts
empresas_suscritas: (dto.empresas_suscritas ?? []).map((x) => this.toObjectId(x)),
centros_suscritos:  (dto.centros_suscritos  ?? []).map((x) => this.toObjectId(x)),
proyectos_suscritos:(dto.proyectos_suscritos ?? []).map((x) => this.toObjectId(x)),
```

Si el body omite alguno de los tres arrays, ese campo se resetea a `[]` en vez de conservar el valor
existente. Reproducido: PATCH con solo `empresas_suscritas: [X]` → OK. PATCH siguiente con solo
`centros_suscritos: [Y]` (sin `empresas_suscritas`) → `centros_suscritos` queda `[Y]` pero
`empresas_suscritas` se borra a `[]`, perdiendo silenciosamente la suscripción anterior.

El frontend actual (`suscripciones-form.component.ts`) siempre envía los 3 arrays juntos, así que no
se dispara en el flujo normal de la UI — pero es un contrato de API roto para cualquier otro caller
(script, futura feature de "agregar un centro sin tocar el resto", integración externa).

**Fix:** hacer merge explícito contra el documento actual en vez de default a `[]`, o documentar
claramente que el endpoint espera siempre el estado completo (y ajustar el DTO para que los 3 arrays
dejen de ser `@IsOptional`, forzando al caller a mandarlos siempre).

---

## 🔵 Limpieza

- **Scripts npm rotos:** `preview:mails` y `test:mails` en `package.json` apuntan a
  `scripts/preview-mails.ts` y `scripts/test-mail-all.ts`, que no existen.
- `uploads/` en la raíz está vacío (legacy filesystem) — eliminar.
- `scripts/create-admin.js` y `create-admin2.js` parecen duplicados de `create-superadmin.js` — consolidar.
- Documentos legacy pre-S3 conservan `contenido: Buffer` sin `s3_key`; decidir si se migran o queda permanente.
- `solicitudes.cambiarEstado` consulta el mismo documento 3 veces (estado previo, update, full para adjunto).
