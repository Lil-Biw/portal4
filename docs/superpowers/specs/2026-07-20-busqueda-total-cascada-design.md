# Búsqueda total cascada — Diseño

**Fecha:** 2026-07-20
**Rama:** feat/documentos-busqueda-cascada

## Resumen

En la página de Documentos (admin), la Tarjeta A (selector de contexto: tabs Empresa/Centro/Proyecto + panel resumen/select) se divide en dos columnas iguales. La columna izquierda no cambia. La columna derecha agrega una "búsqueda total cascada": 3 botones de nivel (Empresa/Centro/Proyecto) que, sin necesidad de elegir una empresa primero, listan en árbol **todas** las empresas/centros/proyectos del sistema junto con sus documentos — filtrados por el panel "Filtrar por tipo / Buscar por nombre" que ya existe arriba de la página. Esto permite responder preguntas como "¿dónde están todos los Contratos, a nivel proyecto, de todas las empresas?" sin navegar empresa por empresa.

Hoy esto no es posible: todos los endpoints de documentos existentes (`GET /empresas/:id/documentos`, `.../centros/:id/documentos`, `.../proyectos/:id/documentos`, y hasta `/documentos-vencidos`) requieren una empresa específica. Se necesita un endpoint nuevo que agregue documentos de **todas** las empresas a la vez.

## Backend

### Endpoint nuevo: `GET /documentos/busqueda-total`

Nuevo módulo standalone `back4/src/documentos-busqueda/` (mismo patrón de `documentos-vencidos/`: sin schema propio, lee directo de `doc_cliente` / `doc_centro_costo` / `doc_proyecto` inyectando esos modelos).

**Query params:**

| Param | Tipo | Notas |
|---|---|---|
| `nivel` | `'empresa' \| 'centro' \| 'proyecto'` | requerido — define qué colecciones consulta y cuántos niveles cascadea |
| `categorias` | string, csv | opcional — subconjunto de `CATEGORIAS_DOCUMENTO`; vacío = sin restricción |
| `nombre` | string | opcional — substring case-insensitive sobre `nombre_display` |

**Comportamiento por `nivel`:**

- `empresa` → recorre las 3 colecciones (`doc_cliente`, `doc_centro_costo`, `doc_proyecto`) de **todas** las empresas y arma el árbol completo de 3 niveles.
- `centro` → recorre `doc_centro_costo` + `doc_proyecto` de **todos** los centros de **todas** las empresas (2 niveles, sin nodo de empresa suelto salvo como breadcrumb).
- `proyecto` → recorre solo `doc_proyecto` de **todos** los proyectos (lista plana, con empresa/centro como breadcrumb).

En los tres casos, el filtro `categorias`/`nombre` aplica sobre los documentos de **cada** colección consultada (ej. en `nivel=empresa` filtra documentos de empresa, de centro y de proyecto por igual).

**Guard:** `@Roles('super_admin', 'admin_smartclarity')` — sin restricción por `empresaId` (a diferencia de `documentos-vencidos`, este endpoint es intencionalmente cross-empresa). La página que lo consume (`documentos-admin-page`) ya está protegida por `soloAdminGuard`, así que `usuario`/consumidor nunca llega aquí.

**Resolución de jerarquía:** `doc_centro_costo` y `doc_proyecto` no guardan `empresa_id`/`centro_costo_id` desnormalizado, solo su FK directa (`centro_costo_id`, `proyecto_id`). El service resuelve nombres y breadcrumbs en memoria con 3 queries batch (`Cliente.find().lean()`, `CentroCosto.find().lean()`, `Proyecto.find().lean()` — colecciones completas, ya se cargan así hoy en el frontend sin problema de volumen) y arma mapas `id → {nombre, cliente_id / centro_costo_ids}` para cruzar. `subido_por_nombre` se resuelve igual que hoy, reutilizando `resolverSubidoPorNombre()`.

**DocumentosBusquedaService — métodos:**

- `buscar(nivel, categorias?, nombre?)`:
  1. Carga mapas de clientes/centros/proyectos (batch, sin populate).
  2. Según `nivel`, hace `find()` con `.select('-contenido')` sobre 1, 2 o 3 colecciones `doc_*`, aplicando `categoria: {$in: categorias}` y `nombre_display: {$regex, $options:'i'}` cuando corresponden.
  3. Cruza cada documento con su entidad dueña (vía los mapas) para anotar `empresa_id/nombre`, `centro_id/nombre`, `proyecto_id/nombre`, `origen_tipo`.
  4. Agrupa en árbol: `empresa[] → centros[] → proyectos[]`, cada nodo con su propio array `documentos[]` (los que matchean el filtro y pertenecen directamente a ese nodo).
  5. Poda nodos sin documentos propios ni descendientes con documentos (si hay filtro activo; sin filtro se muestra todo el árbol aunque un nodo esté vacío).

**Respuesta** (forma árbol, ejemplo para `nivel=empresa`):

```ts
interface BusquedaCascadaEmpresa {
  _id: string; nombre: string;
  documentos: DocBusquedaItem[];
  centros: {
    _id: string; nombre: string;
    documentos: DocBusquedaItem[];
    proyectos: { _id: string; nombre: string; documentos: DocBusquedaItem[] }[];
  }[];
}

interface DocBusquedaItem {
  _id: string; nombre_display: string; categoria?: string;
  tipo_mime?: string; tamano_bytes?: number; subido_en?: string;
  subido_por_nombre?: string; tipo_contenido?: 'archivo' | 'link'; link_url?: string;
}
```

Para `nivel=centro` la raíz es `centros[]` (mismo shape de centro, sin envolver en empresa); para `nivel=proyecto`, `proyectos[]` plano con `empresa_nombre`/`centro_nombre` agregados como breadcrumb en cada item.

No se agrega paginación: el volumen de empresas/centros/proyectos de este portal es bajo (decenas, no miles) y no justifica esa complejidad ahora.

## Frontend

### `DocumentosService` — cambios

- Nuevos tipos `BusquedaCascadaEmpresa`/`BusquedaCascadaCentro`/`BusquedaCascadaProyecto` (o un tipo unión simple) espejo del backend.
- `busquedaCascada = signal<...>([])`.
- `buscarCascada(nivel, categorias?, nombre?)` → `GET /documentos/busqueda-total?...` → set del signal. Cada documento recibe su `url` calculada según `origen_tipo` (reutilizando `addUrl`), apuntando al endpoint nested existente (`/empresas/:eId/documentos/:id`, `.../centros/:cId/documentos/:id`, `.../proyectos/:pId/documentos/:id`) — sin endpoint de descarga nuevo.

### `DocumentosAdminPageComponent` — cambios

- Nuevo signal `nivelBusqueda = signal<'empresa'|'centro'|'proyecto'>('empresa')`, independiente de `tabJerarquia`.
- `effect()` (o llamada directa en los handlers de nivel/filtro): recarga `buscarCascada(...)` cuando cambia `nivelBusqueda`, o las `categorias`/`nombre` del panel de filtros de arriba (reutiliza `panels[docTipoActual]` — mismo estado que ya filtra "Vigentes"/"Vencidos").
- Método `seleccionarNodoCascada(nivel, empresaId, centroId?, proyectoId?)`: fija `selectedEmpresaId`/`selectedCentroId`/`selectedProyectoId` y `tabJerarquia`, delegando en los handlers existentes `onEmpresaChange()`/`onCentroChange()`/`onProyectoChange()` — no se duplica lógica de carga, Tarjeta B se refresca sola porque ya reacciona a esos signals.

### HTML — Tarjeta A

- El contenedor pasa a `display:grid;grid-template-columns:1fr 1fr` con el bloque actual (tabs + panel resumen/select) en la primera columna, sin tocar su marcado interno.
- Segunda columna: 3 botones de nivel (mismo estilo visual que los tabs existentes) + árbol renderizado con `@for` anidados (empresa → centro → proyecto), cada nivel colapsable con un `@if`/toggle simple (sin librería de árbol nueva). Cada documento es una fila clickeable (abre/descarga) y cada nodo de entidad es clickeable (fija contexto).
- Estado vacío: "Sin resultados para el filtro actual" si el árbol completo queda sin documentos tras podar.

## Flujo completo

```
Usuario entra a Documentos → nivelBusqueda='empresa' por defecto → buscarCascada('empresa')
  → GET /documentos/busqueda-total?nivel=empresa
  → árbol completo (todas las empresas) se pinta a la derecha

Usuario marca categoría "Contrato" en el panel de filtros de arriba
  → mismo signal que ya filtra Vigentes/Vencidos → buscarCascada('empresa', ['Contrato'])
  → árbol se poda a solo ramas con Contratos

Usuario cambia nivel a "Proyecto"
  → buscarCascada('proyecto', ['Contrato'])
  → lista plana de todos los proyectos con Contratos, de todas las empresas

Usuario hace clic en un proyecto del árbol
  → seleccionarNodoCascada('proyecto', empresaId, centroId, proyectoId)
  → selectedEmpresaId/CentroId/ProyectoId + tabJerarquia='proyecto' (vía onProyectoChange)
  → Tarjeta B (Documentación/Solicitudes) se refresca sola con el contexto fijado
```

## Lo que NO incluye este diseño

- Paginación real del árbol (volumen actual no lo justifica).
- Caja de texto de búsqueda dedicada al árbol (reutiliza el filtro de nombre/categoría ya existente arriba).
- Acciones (eliminar, marcar vencido, editar categoría) desde el árbol de búsqueda total — es de solo navegación + descarga; para gestionar un documento hay que entrar a su contexto.
- Acceso para rol `usuario` (consumidor) — endpoint restringido a `super_admin`/`admin_smartclarity`.
