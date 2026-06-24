# Documentos Vencidos — Diseño

**Fecha:** 2026-06-23
**Rama:** feat/restructuracion-rutas

## Resumen

Agregar una sección de documentos inválidos/vencidos a la vista de Documentación. Cualquier documento activo puede ser marcado como vencido por cualquier perfil (admin o consumidor), lo que lo mueve físicamente a una colección separada en MongoDB. Un tab pequeño "Vencidos" junto al tab "Documentación" muestra los últimos 20 documentos vencidos del contexto activo, de forma solo lectura.

## Backend

### Nueva colección MongoDB: `documentos_vencidos`

Schema con metadata únicamente — sin buffer de contenido binario, ya que los documentos vencidos no son descargables.

**Campos:**

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | auto |
| `nombre_display` | string | required |
| `categoria` | string? | opcional |
| `tipo_mime` | string | required |
| `tamano_bytes` | number? | opcional |
| `origen_tipo` | `'empresa' \| 'centro' \| 'proyecto'` | nivel jerárquico de origen |
| `empresa_id` | ObjectId | required, FK a clientes |
| `centro_id` | ObjectId? | si origen es centro o proyecto |
| `proyecto_id` | ObjectId? | si origen es proyecto |
| `empresa_nombre` | string | desnormalizado para display |
| `centro_nombre` | string? | desnormalizado para display |
| `proyecto_nombre` | string? | desnormalizado para display |
| `subido_en` | Date? | fecha original de subida |
| `vencido_en` | Date | fecha en que se marcó como vencido |

**Índices:** `empresa_id`, `vencido_en` (desc).

### Módulo `documentos-vencidos/`

5 archivos siguiendo el patrón estándar del proyecto:

- `documentos-vencidos.schema.ts` — colección `documentos_vencidos`, timestamps con `creado_en`/`actualizado_en`
- `documentos-vencidos.dto.ts` — `CreateDocVencidoDto` con todos los campos del schema usando class-validator
- `documentos-vencidos.service.ts`:
  - `crear(dto: CreateDocVencidoDto)` — inserta en la colección
  - `listarUltimos20(empresaId, centroId?, proyectoId?)` — filtra por contexto, `.sort({ vencido_en: -1 }).limit(20).lean()`
- `documentos-vencidos.controller.ts` — `GET /documentos-vencidos?empresaId=&centroId=&proyectoId=`
- `documentos-vencidos.module.ts` — exporta `DocumentosVencidosService`

Registrar en `app.module.ts`.

### Endpoints "vencer" en controllers existentes

Cada controller existente recibe un nuevo método que:
1. Busca el subdocumento en el array `documentos[]` de la entidad
2. Extrae la metadata (sin el buffer `contenido`)
3. Elimina el subdocumento con `$pull { documentos: { _id: docId } }`
4. Crea el registro en `documentos_vencidos` via `DocumentosVencidosService.crear()`

**Endpoints nuevos:**

```
PATCH /empresas/:id/documentos/:docId/vencer
PATCH /empresas/:id/centros/:centroId/documentos/:docId/vencer
PATCH /empresas/:id/centros/:centroId/proyectos/:proyectoId/documentos/:docId/vencer
```

Los módulos `ClientesModule`, `CentrosCostosModule` y `ProyectosModule` importan `DocumentosVencidosModule`.

Los tres endpoints están protegidos con `JwtAuthGuard` y `RolesGuard` (roles: `admin_smartclarity`, `super_admin`, `usuario`). Ambos perfiles pueden marcar como vencido.

## Frontend

### Nuevo tipo `DocumentoVencidoItem`

```ts
interface DocumentoVencidoItem {
  _id: string;
  nombre_display: string;
  categoria?: string;
  tipo_mime: string;
  tamano_bytes?: number;
  subido_en?: string;
  vencido_en: string;
  origen_tipo: 'empresa' | 'centro' | 'proyecto';
  empresa_nombre: string;
  centro_nombre?: string;
  proyecto_nombre?: string;
}
```

### `DocumentosService` — cambios

- `documentosVencidos = signal<DocumentoVencidoItem[]>([])` — estado reactivo
- `cargarVencidos(empresaId, centroId?, proyectoId?)` — `GET /documentos-vencidos?...` → actualiza `documentosVencidos`
- `marcarVencido(docUrl, tipo, empresaId, centroId?, proyectoId?)`:
  - `PATCH` al endpoint correspondiente según `tipo`
  - En `next`: recarga docs activos del nivel + recarga vencidos

### Cambios en `DocumentosAdminPageComponent` y `DocumentosConsumidorPageComponent`

**Tab Vencidos:**
- Nuevo valor `'vencidos'` en el tipo del signal `tabAdminActiva` / `tabConsumidorActiva`
- Tab pequeño renderizado junto al tab "Documentación", antes de "Solicitudes"
- Al activar el tab o al cambiar el nivel jerárquico (empresa/centro/proyecto): llamar `service.cargarVencidos(...)` con el contexto activo

**Botón "Marcar vencido":**
- Aparece en cada fila de documento activo, junto al botón "Eliminar"
- Visible solo cuando `puedeGestionarDocumento` es `true`
- Al hacer clic: llama `marcarVencido(doc.url, docTipoActual, empresaId, centroId?, proyectoId?)`

**Vista del tab Vencidos:**
- Lista read-only de `service.documentosVencidos()`
- Columnas: nombre, categoría, tipo, fecha subido, fecha vencido
- Sin botón descargar, sin botón eliminar, sin botón restaurar
- Texto fijo al pie: "Mostrando los últimos 20 documentos vencidos"
- Si la lista está vacía: mensaje "Sin documentos vencidos"

## Flujo completo

```
Usuario hace clic en "Marcar vencido" en doc X (nivel centro)
  → PATCH /empresas/:eId/centros/:cId/documentos/:docId/vencer
  → Backend: $pull de centros_costos.documentos + INSERT en documentos_vencidos
  → Frontend: recarga documentosCentro + recarga documentosVencidos
  → UI actualiza lista activa (doc desaparece) y lista vencidos (doc aparece al tope)
```

## Lo que NO incluye este diseño

- Restaurar documentos vencidos a activos
- Descargar documentos vencidos
- Eliminar registros de la colección vencidos
- Paginación (solo últimos 20, sin navegación)
- Notificaciones al marcar vencido
