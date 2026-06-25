# Spec: Score Documental completo + quitar estado vencido de solicitudes

**Fecha:** 2026-06-25

## Contexto

El score documental (pct = aprobados / total × 100) actualmente solo lee `solicitudesService.solicitudes()`. Los documentos subidos directamente a la pestaña de documentación son invisibles para el cálculo. Además, el estado `vencido` en solicitudes se elimina: el concepto de "vencimiento" queda exclusivo del módulo de documentos.

---

## Parte 1 — Eliminar estado `vencido` de solicitudes

### Backend

| Archivo | Cambio |
|---|---|
| `solicitudes.schema.ts` | Enum `['pendiente', 'revision', 'aprobado', 'rechazado']` (sin `vencido`) |
| `solicitudes.dto.ts` | Igual |
| `solicitudes.service.ts` | Guard de adjuntar archivo: `['pendiente', 'rechazado']` (sin `vencido`) |

### Frontend

| Archivo | Cambio |
|---|---|
| `solicitudes.service.ts` | `EstadoSolicitud` type y mapa de labels sin `vencido` |
| `topbar.component.ts` | Filtro de notificaciones de solicitudes: quitar `vencido`; quitar color amarillo para ese estado |
| `inicio-page.component.ts` | Filtro de solicitudes pendientes de acción, conteos y colores: quitar `vencido` |
| `mi-ficha-page.component.ts` | Conteos de solicitudes: quitar `vencido` |
| `mi-proyecto-detalle-page.component.ts` | Estilo badge solicitudes: quitar rama `vencido` |
| `resumen-page.component.ts` | Filtro de alertas: quitar `vencido` |

> `ScoreDocumental.vencido` en `utils.ts` **se mantiene**: representa documentos vencidos, no solicitudes.

---

## Parte 2 — Score documental incluye documentación

### Fórmula

```
aprobados = solicitudes con estado 'aprobado' + docsActivos
total     = solicitudes.length + docsActivos + docsVencidos
pct       = total > 0 ? Math.round(aprobados / total * 100) : 50
```

- **Documentos activos** (en pestaña Documentación) → cuentan como aprobados y en total.
- **Documentos vencidos** (en pestaña Vencidos) → solo cuentan en total (bajan el %).

### Cambios en `utils.ts`

```ts
export function calcularScoreDocumental(
  solicitudes: { estado: string }[],
  docsActivos = 0,
  docsVencidos = 0,
): ScoreDocumental {
  const aprobados = solicitudes.filter(s => s.estado === 'aprobado').length + docsActivos;
  const revision  = solicitudes.filter(s => s.estado === 'revision').length;
  const rechazado = solicitudes.filter(s => s.estado === 'rechazado').length;
  const pendiente = solicitudes.filter(s => s.estado === 'pendiente').length;
  const total     = solicitudes.length + docsActivos + docsVencidos;
  return {
    pct: total > 0 ? Math.round(aprobados / total * 100) : 50,
    aprobados, revision, vencido: docsVencidos, rechazado, pendiente, total,
  };
}
```

### Páginas y fuentes de datos

#### `inicio-page.component.ts` y `mi-ficha-page.component.ts`

Ambas páginas pasan de no tener `DocumentosService` a inyectarlo. En el `effect()` que reacciona a `empresaSeleccionada`, añadir:

```ts
documentosService.cargarEmpresa(empresa._id);
documentosService.cargarTodosCentros(empresa._id, centros);
documentosService.cargarTodosProyectos(empresa._id, centros);
documentosService.cargarVencidos(empresa._id);
```

`computed` para el score:

```ts
protected scoreDocumental = computed(() => {
  const docsActivos =
    documentosService.documentosEmpresa().length +
    documentosService.documentosPorCentro().reduce((s, g) => s + g.docs.length, 0) +
    documentosService.documentosPorProyecto().reduce((s, g) => s + g.docs.length, 0);
  const docsVencidos = documentosService.documentosVencidos().length;
  return calcularScoreDocumental(solicitudesService.solicitudes(), docsActivos, docsVencidos);
});
```

> `cargarTodosCentros` necesita la lista de centros: ya la tienen ambas páginas vía `centrosDeEmpresa()` / `centrosService.centros()`.

#### `mi-proyecto-detalle-page.component.ts`

Ya inyecta `DocumentosService`. Añadir llamada a `cargarVencidos(empresaId, centroId, proyectoId)` en el effect constructor. Actualizar el computed:

```ts
protected scoreDoc = computed(() => {
  const docsActivos  = documentosService.documentosProyecto().length;
  const docsVencidos = documentosService.documentosVencidos().length;
  return calcularScoreDocumental(solicitudesProyecto(), docsActivos, docsVencidos);
});
```

#### `mis-proyectos-page.component.ts`

El método `scoreDeProyecto(proyectoId)` se actualiza: inyectar `DocumentosService`, cargar todos los proyectos de la empresa con `cargarTodosProyectos`, y resolver el conteo de docs activos por proyecto desde `documentosPorProyecto()`. Los vencidos por proyecto no se desglosan (la API solo expone vencidos a nivel empresa/centro/proyecto individualmente); se pasan como `0` — mejora futura si se necesita.

```ts
scoreDeProyecto(proyectoId: string) {
  const sols = solicitudesService.solicitudes().filter(s => asId(s.proyecto_id) === proyectoId);
  const grupo = documentosService.documentosPorProyecto().find(g => /* match por id */);
  const docsActivos = grupo?.docs.length ?? 0;
  return calcularScoreDocumental(sols, docsActivos, 0);
}
```

> **Nota:** `documentosPorProyecto` agrupa por nombre de proyecto, no por ID. Se necesita un computed auxiliar que cruce los proyectos del service con el grupo de documentos por nombre para el match correcto. Ver implementación.

---

## Archivos afectados (resumen)

### Backend
- `back4/src/solicitudes/solicitudes.schema.ts`
- `back4/src/solicitudes/solicitudes.dto.ts`
- `back4/src/solicitudes/solicitudes.service.ts`

### Frontend
- `front4/src/app/shared/utils.ts`
- `front4/src/app/features/solicitudes/solicitudes.service.ts`
- `front4/src/app/layout/topbar/topbar.component.ts`
- `front4/src/app/features/dashboard/pages/inicio-page.component.ts`
- `front4/src/app/features/dashboard/pages/mi-ficha-page.component.ts`
- `front4/src/app/features/proyectos/pages/mi-proyecto-detalle-page.component.ts`
- `front4/src/app/features/proyectos/pages/mis-proyectos-page.component.ts`
- `front4/src/app/features/dashboard/pages/resumen-page.component.ts`

---

## Fuera de alcance

- Migración de datos: solicitudes existentes con `estado: 'vencido'` en MongoDB quedan como están (el enum del schema solo valida inserts/updates nuevos). Si se necesita migración, es tarea separada.
- Score en `resumen-page` (admin): calcula su propio % inline y no usa `calcularScoreDocumental`. Queda fuera de este spec.
