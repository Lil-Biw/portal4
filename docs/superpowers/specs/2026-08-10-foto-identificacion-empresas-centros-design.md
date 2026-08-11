# Foto de identificación en empresas y centros de costo — Diseño

## Contexto

`CLAUDE.md` documenta que `clientes.logo` es la única excepción al almacenamiento
de archivos en S3: sigue guardándose como `Buffer` en Mongo. Esa pieza ya está
implementada de punta a punta — schema, endpoints `POST/GET /empresas/:id/logo`,
formulario admin (`cliente-form.component`) — pero **no se muestra en ningún
lugar del modo consumidor**.

Los centros de costo no tienen ningún campo de imagen hoy: ni schema, ni
endpoints, ni input en el formulario admin, ni nada en las vistas de
consumidor.

## Objetivo

Permitir identificar visualmente una empresa y cada uno de sus centros de
costo mediante una **fotografía real del lugar** (no un logo/isotipo de
marca — alguien va físicamente y la toma), y mostrarla en los puntos del
modo consumidor donde hoy falta, más el punto de carga en el modo admin
para centros de costo.

## Alcance

1. **Backend**: nuevo campo `foto` en `CentroCosto` (Buffer en Mongo, mismo
   patrón que `Cliente.logo`) + endpoints para subir/servir.
2. **Frontend admin**: panel lateral de carga de foto en `centro-form`.
3. **Frontend consumidor**:
   - **Mi ficha** → recuadro "Información general": foto de la empresa a la
     derecha, datos a la izquierda (dato ya existente en backend/admin,
     `Cliente.logo` — solo falta visualizarlo).
   - **Mis centros (listado)** → miniatura de la foto del centro a la
     izquierda del nombre, sin desplazar el donut de score que ya ocupa la
     esquina superior derecha de cada card.
   - **Detalle de centro** → recuadro "Información general": foto del
     centro a la derecha, datos a la izquierda (mismo patrón que Mi ficha).

## Fuera de alcance

- No se modifica el dato/endpoints ya existentes del logo de empresa —
  solo se consume desde el frontend consumidor.
- No se agrega compresión/resize de imágenes. Se mantiene el patrón actual:
  buffer crudo, límite de 20MB vía `OPCIONES_SUBIDA`, sin validación de
  mimetype más allá del `accept="image/*"` del input.
- No se migra nada a S3 — se replica la excepción ya documentada para
  `Cliente.logo`.
- No se modifica el sidebar (`sidebar.component.ts`), que ya muestra el
  logo de empresa en su propio contexto.

## Backend

### Schema — `back4/src/centros-costos/centros-costos.schema.ts`

```ts
@Prop({ type: { contenido: Buffer, tipo_mime: String, nombre: String } })
foto?: { contenido: Buffer; tipo_mime: string; nombre: string };
```

El campo se llama **`foto`** y no `logo`: es una fotografía real del lugar,
no un isotipo de marca — se distingue a propósito del campo `logo` de
`Cliente` para no confundir semánticas en el código ni en las etiquetas de
UI ("Foto del centro" vs. "Logo de empresa").

`findAll`, `findAllByCliente`, `findOne` y `update` deben excluir el
binario con `.select('-foto.contenido')`, igual que ya hace `clientes`
con `logo.contenido`.

### Service — `centros-costos.service.ts`

- `subirFoto(centroId, archivo)`: verifica que el centro exista
  (`NotFoundException` si no), guarda
  `{ contenido: archivo.buffer, tipo_mime: archivo.mimetype, nombre: archivo.originalname }`.
- `servirFoto(centroId)`: retorna `{ buffer, tipo_mime, nombre }`,
  replicando el manejo defensivo del tipo del `Buffer` que ya usa
  `clientes.service.ts` (Mongo puede devolver `Binary` en vez de `Buffer`
  nativo según el driver).

### Controller — `centros-costos.controller.ts`

Dentro de `CentrosCostosController`
(`@Controller('empresas/:empresaId/centros')`, `@UseGuards(EmpresaAccessGuard)`):

- `POST :centroId/foto` — `@Roles('super_admin', 'admin_smartclarity')`,
  `@UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))`.
- `GET :centroId/foto` — `@Public()`, sirve inline vía el helper
  `sendFile` (mismo criterio que el logo de empresa: público porque el
  frontend arma la URL directamente en un `<img src>`, sin adjuntar JWT).

## Frontend — Modelo

`front4/src/app/shared/models/centro.model.ts`: agregar
`foto?: { tipo_mime: string; nombre: string }` a la interfaz `CentroCosto`.

## Frontend — Admin (`centro-form.component.*`)

- Panel lateral a la derecha del formulario (`grid-template-columns: 1fr 230px`):
  - Preview de la foto actual, o placeholder con ícono de cámara y borde
    punteado si no hay ninguna.
  - Botón "Cambiar foto" + input de tipo `file` oculto (`accept="image/*"`).
  - Texto de ayuda breve.
- `@Output() fotoFile = new EventEmitter<File | null>()`, análogo a
  `logoFile` en `cliente-form`.
- `onFotoSelected()` genera preview con `FileReader`.
- `resolveFotoUrl()` arma `GET /empresas/:empresaId/centros/:centroId/foto`
  para precargar la foto en modo edición.

## Frontend — Service (`centros.service.ts`)

Agregar `subirFoto(empresaId, centroId, file, onSuccess, onError)` →
`POST /empresas/:empresaId/centros/:centroId/foto` con `FormData` campo
`archivo`, siguiendo el mismo flujo que `ClientesService.subirLogo`: la
foto se sube en una segunda llamada, después de crear o actualizar el
centro.

Conectar en la página que aloja `centro-form` con un signal `pendingFoto`,
igual patrón que `pendingLogo` en `clientes-page.component`.

## Frontend — Consumidor

### Mi ficha (`mi-ficha-page.component.html`)

El recuadro "Información general" pasa a `grid-template-columns: 1fr 200px`:
`<dl>` a la izquierda sin cambios, columna de foto a la derecha reutilizando
el getter `logoUrl` del patrón ya usado en `sidebar.component.ts`
(`GET /empresas/:id/logo`). Sin logo → placeholder con ícono de cámara y
borde punteado.

### Mis centros — listado (`mis-centros-page.component.html`)

En el header de cada card
(`display:flex; align-items:flex-start; justify-content:space-between`),
el bloque de texto izquierdo (hoy `flex:1`) pasa a ser
`display:flex; align-items:center; gap:.55rem` con:

- Miniatura ~40px de la foto
  (`GET /empresas/:empresaId/centros/:centroId/foto`), o placeholder con
  ícono de cámara si no hay.
- El bloque nombre / código / ciudad, igual que hoy.

El `<app-donut-arc>` **no se mueve** — sigue en su posición actual, a la
derecha del header.

### Mis centros — detalle (`mis-centros-page.component.html`, sección `centroActivo`)

El recuadro 1 "Información general" pasa a
`grid-template-columns: 1fr 200px`, mismo patrón que Mi ficha, usando
`GET /empresas/:empresaId/centros/:centroId/foto`.

## Manejo de errores

- **Subida**: si el archivo excede el límite de `OPCIONES_SUBIDA` (20MB),
  el interceptor de Multer ya lo rechaza. No se agrega validación
  adicional de mimetype en el backend — consistente con el patrón actual
  de `logo` de cliente y de `noticias`, que tampoco validan más allá del
  `accept="image/*"` del input.
- **Falta de foto**: en todas las vistas de consumidor y en el admin, la
  ausencia de `tipo_mime` en `foto`/`logo` deriva siempre en un placeholder
  visual (ícono de cámara), nunca en un error visible.
- **Backend**: `NotFoundException` si `centroId` no existe, comportamiento
  estándar ya usado en el resto del módulo.

## Testing

No existen tests unitarios previos para `subirLogo`/`servirLogo` de
clientes que replicar 1:1 — la validación es manual:

1. **Admin**: crear/editar un centro, subir una foto desde el panel
   lateral, confirmar que el preview se actualiza.
2. **Consumidor — listado**: confirmar que la miniatura aparece junto al
   nombre sin desplazar ni tapar el donut de score.
3. **Consumidor — detalle y Mi ficha**: confirmar que la foto grande
   aparece a la derecha del recuadro "Información general".
4. **Placeholder**: confirmar que empresas/centros sin foto cargada
   muestran el ícono de cámara con borde punteado, en las tres vistas.
