# Tag "quién subió" en la lista de documentos (admin)

## Contexto

En `documentos-admin-page` cada fila de documento muestra un pill de nivel
(Empresa/Centro/Proyecto) y la fecha de subida (`Subido: {{ formatFechaHora(d.subido_en) }}`),
pero no quién lo subió. El backend ya guarda `subido_por` (ObjectId → Usuario)
en `doc_cliente`, `doc_centro_costo` y `doc_proyecto` al momento de subir
(`documentos.helper.ts` → `agregarLink`/`agregarArchivo`), pero ese campo solo
se usa hoy para el correo de notificación de subida — nunca se expone a la API
ni se pinta en pantalla.

## Alcance

- Solo `documentos-admin-page` (modo admin). `documentos-consumidor-page` no
  se toca — comparte las mismas interfaces de datos, pero no renderiza el tag.
- Las 4 vistas de la página admin: lista principal (empresa/centro/proyecto
  según `docTipo`), "todos los centros", "todos los proyectos" y "vencidos".

## Diseño visual

Pill separado, mismo lenguaje visual que los pills existentes
(`font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px`),
color teal para no superponerse semánticamente con el ámbar ya usado para
"vencido"/"marcar vencido":

```html
@if (d.subido_por_nombre) {
  <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ d.subido_por_nombre }}</span>
}
```

Se ubica junto al span de fecha existente (`Subido: ...`), dentro del mismo
contenedor `.line2`/segunda fila de metadatos de cada fila de documento.

Si el documento no tiene `subido_por_nombre` (subido antes de este cambio,
o subido sin usuario autenticado), el pill simplemente no se renderiza — sin
placeholder tipo "Desconocido".

## Backend

### 1. Resolución de nombre — función compartida

Nueva función standalone (no método de la clase `DocumentosHelper`, para no
afectar a `activos`/`actividades` que reutilizan esa clase) en
`back4/src/common/helpers/documentos.helper.ts`:

```ts
export async function resolverSubidoPorNombre(
  docs: Record<string, unknown>[],
  usuarioModel: Model<any>,
): Promise<Record<string, unknown>[]> {
  const ids = [...new Set(
    docs.map(d => d['subido_por']).filter(Boolean).map(String)
  )];
  if (!ids.length) return docs;

  const usuarios = await usuarioModel
    .find({ _id: { $in: ids } })
    .select('nombre')
    .lean();
  const nombreMap = new Map(usuarios.map(u => [String(u._id), (u as any).nombre]));

  return docs.map(d => {
    const nombre = d['subido_por'] ? nombreMap.get(String(d['subido_por'])) : undefined;
    return nombre ? { ...d, subido_por_nombre: nombre } : d;
  });
}
```

Un solo `find` batch por listado (no N+1), siguiendo el mismo patrón que ya
usa `notificar-documento.helper.ts` para resolver un solo usuario, escalado a
lista.

### 2. `listarDocumentos` en los 3 servicios dueños

`clientes.service.ts`, `centros-costos.service.ts`, `proyectos.service.ts`
— los tres ya tienen `usuarioModel` inyectado (lo usan para las notificaciones
de documento subido), no requiere wiring nuevo:

```ts
async listarDocumentos(id: string) {
  const docs = await this.docsHelper.listar(id);
  return resolverSubidoPorNombre(docs, this.usuarioModel);
}
```

Los 3 controllers (`clientes.controller.ts`, `centros-costos.controller.ts`,
`proyectos.controller.ts`) no requieren cambios: son passthrough directo sin
DTO/interceptor que filtre campos nuevos.

### 3. Vencidos

`documentos-vencidos.schema.ts` y `CreateDocVencidoDto` suman:
```ts
subido_por?: Types.ObjectId;
```

Los 3 `vencerDocumento` (en `clientes.service.ts`, `centros-costos.service.ts`,
`proyectos.service.ts`) agregan `subido_por: doc.subido_por` al objeto que
pasan a `documentosVencidosService.crear({...})`.

`DocumentosVencidosService` (método que respalda `GET /documentos-vencidos`,
usado por la vista "vencidos" de la página admin) aplica la misma función
`resolverSubidoPorNombre` antes de devolver la lista.

Los registros de vencidos creados **antes** de este cambio no tendrán
`subido_por` guardado → no muestran el tag (comportamiento esperado, no es
un bug).

## Frontend

`front4/src/app/features/documentos/documentos.service.ts`:
```ts
export interface DocumentoItem {
  // ...campos existentes
  subido_por_nombre?: string;
}

export interface DocumentoVencidoItem {
  // ...campos existentes
  subido_por_nombre?: string;
}
```

`documentos-admin-page.component.html`: agregar el pill (sección "Diseño
visual" arriba) en los 4 bloques que hoy ya tienen el span `Subido: ...`
(líneas ~371, ~428, ~489, y el bloque de vencidos ~540-563 según la
exploración del código actual — los números de línea pueden variar levemente
al momento de implementar).

`documentos-consumidor-page.component.html`: sin cambios.

## Testing

- Backend: test unitario de `resolverSubidoPorNombre` — casos: sin
  `subido_por` en ningún doc (no llama a la DB), con `subido_por` repetidos
  (un solo `find`), con un `subido_por` que no matchea ningún usuario (omite
  el campo, no revienta).
- Backend: test de que `listarDocumentos` (los 3 servicios) incluye
  `subido_por_nombre` cuando corresponde.
- Manual: subir un documento nuevo en cada nivel (empresa/centro/proyecto) y
  confirmar que aparece el pill con el nombre del usuario logueado; abrir un
  documento existente (subido antes del cambio) y confirmar que no rompe la
  fila ni muestra un pill vacío; marcar un documento como vencido y verificar
  que el pill persiste en la vista "vencidos".

## Fuera de alcance

- `documentos-consumidor-page` (decisión explícita: solo admin ve quién
  subió).
- Backfill de `subido_por` para documentos ya existentes sin ese dato.
- Mostrar avatar/iniciales (opción C descartada) o fusionar fecha+nombre en
  un solo texto (opción A descartada) — se eligió pill separado (opción B).
