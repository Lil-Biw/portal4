# Score Documental completo + quitar vencido de solicitudes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar el estado `vencido` de solicitudes y ampliar el score documental para que incluya los documentos de la pestaña de documentación (activos y vencidos).

**Architecture:** Se modifican primero las capas compartidas (backend enum, frontend type, utils), luego los componentes que los consumen. El `DocumentosService` se extiende para almacenar el `proyectoId` junto a cada grupo de docs, permitiendo el cómputo correcto en `mis-proyectos-page`. La función `calcularScoreDocumental` recibe dos parámetros opcionales: `docsActivos` y `docsVencidos`.

**Tech Stack:** NestJS + Mongoose (backend), Angular 21 signals/computed/effect (frontend)

## Global Constraints

- Angular 18+ control flow (`@if`, `@for`, `@let`) — sin `*ngIf`/`*ngFor`
- Signals para todo estado reactivo — sin `BehaviorSubject`
- Sin `any` — tipar correctamente
- Todos los componentes son standalone
- `asId()` obligatorio al comparar ObjectIds

---

### Task 1: Backend — quitar `vencido` del enum de solicitudes

**Files:**
- Modify: `back4/src/solicitudes/solicitudes.schema.ts:14`
- Modify: `back4/src/solicitudes/solicitudes.dto.ts:22`
- Modify: `back4/src/solicitudes/solicitudes.service.ts:283`

**Interfaces:**
- Produces: El backend rechaza con 400 cualquier intento de setear `estado: 'vencido'` en una solicitud nueva o existente; adjuntar archivo solo es posible desde `pendiente` o `rechazado`.

- [ ] **Step 1: Editar schema**

En `back4/src/solicitudes/solicitudes.schema.ts`, línea 14, cambiar:
```ts
@Prop({ enum: ['pendiente', 'revision', 'aprobado', 'rechazado', 'vencido'], default: 'pendiente' }) estado: string;
```
por:
```ts
@Prop({ enum: ['pendiente', 'revision', 'aprobado', 'rechazado'], default: 'pendiente' }) estado: string;
```

- [ ] **Step 2: Editar DTO**

En `back4/src/solicitudes/solicitudes.dto.ts`, línea 22, cambiar:
```ts
@IsEnum(['pendiente', 'revision', 'aprobado', 'rechazado', 'vencido']) estado: string;
```
por:
```ts
@IsEnum(['pendiente', 'revision', 'aprobado', 'rechazado']) estado: string;
```

- [ ] **Step 3: Editar guard de adjuntar archivo**

En `back4/src/solicitudes/solicitudes.service.ts`, línea 283, cambiar:
```ts
if (!['pendiente', 'rechazado', 'vencido'].includes(solicitud.estado)) {
```
por:
```ts
if (!['pendiente', 'rechazado'].includes(solicitud.estado)) {
```

- [ ] **Step 4: Verificar compilación backend**

```bash
cd back4 && npm run build 2>&1 | tail -20
```
Expected: sin errores de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add back4/src/solicitudes/solicitudes.schema.ts back4/src/solicitudes/solicitudes.dto.ts back4/src/solicitudes/solicitudes.service.ts
git commit -m "feat(back): quitar estado vencido de solicitudes"
```

---

### Task 2: Frontend — quitar `vencido` del tipo y utils; actualizar `calcularScoreDocumental`

**Files:**
- Modify: `front4/src/app/features/solicitudes/solicitudes.service.ts`
- Modify: `front4/src/app/shared/utils.ts`

**Interfaces:**
- Consumes: nada nuevo
- Produces:
  - `EstadoSolicitud = 'pendiente' | 'revision' | 'aprobado' | 'rechazado'`
  - `calcularScoreDocumental(solicitudes, docsActivos?, docsVencidos?): ScoreDocumental`

- [ ] **Step 1: Editar `EstadoSolicitud` y mapa de labels**

En `front4/src/app/features/solicitudes/solicitudes.service.ts`, cambiar línea 6:
```ts
export type EstadoSolicitud = 'pendiente' | 'revision' | 'aprobado' | 'rechazado';
```

Cambiar el método `estadoLabel` (líneas 196–202):
```ts
private estadoLabel(estado: EstadoSolicitud): string {
  const map: Record<EstadoSolicitud, string> = {
    pendiente: 'Pendiente', revision: 'En revisión',
    aprobado: 'Aprobado',   rechazado: 'Rechazado',
  };
  return map[estado];
}
```

- [ ] **Step 2: Actualizar `calcularScoreDocumental` en utils.ts**

Reemplazar desde la línea `export interface ScoreDocumental` hasta el final de `scoreChipLabelFn`:

```ts
export interface ScoreDocumental {
  pct: number; aprobados: number; revision: number;
  vencido: number; rechazado: number; pendiente: number; total: number;
}

export function calcularScoreDocumental(
  solicitudes: { estado: string }[],
  docsActivos = 0,
  docsVencidos = 0,
): ScoreDocumental {
  if (solicitudes.length === 0 && docsActivos === 0 && docsVencidos === 0)
    return { pct: 50, aprobados: 0, revision: 0, vencido: 0, rechazado: 0, pendiente: 0, total: 0 };
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

export function scoreChipVariantFn(pct: number): 'ok' | 'warning' | 'danger' {
  if (pct >= 80) return 'ok';
  if (pct >= 50) return 'warning';
  return 'danger';
}

export function scoreChipLabelFn(pct: number): string {
  if (pct >= 80) return 'Bueno';
  if (pct >= 50) return 'Regular';
  return 'Bajo';
}
```

- [ ] **Step 3: Verificar compilación frontend**

```bash
cd front4 && npx tsc --noEmit 2>&1 | head -30
```
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add front4/src/app/features/solicitudes/solicitudes.service.ts front4/src/app/shared/utils.ts
git commit -m "feat(front): quitar vencido de EstadoSolicitud; calcularScoreDocumental acepta docs"
```

---

### Task 3: Limpiar referencias a `vencido` de solicitudes en componentes UI

**Files:**
- Modify: `front4/src/app/layout/topbar/topbar.component.ts`
- Modify: `front4/src/app/features/dashboard/pages/inicio-page.component.ts`
- Modify: `front4/src/app/features/dashboard/pages/mi-ficha-page.component.ts`
- Modify: `front4/src/app/features/proyectos/pages/mi-proyecto-detalle-page.component.ts`
- Modify: `front4/src/app/features/dashboard/pages/resumen-page.component.ts`

**Interfaces:**
- Consumes: `EstadoSolicitud` sin `vencido` (Task 2)
- Produces: UI sin referencias a `vencido` en el contexto de solicitudes

- [ ] **Step 1: topbar.component.ts — filtro de notificaciones de solicitudes**

Localizar el bloque de notificaciones de solicitudes (líneas ~305–334). Cambiar:
```ts
.filter(s => s.estado === 'pendiente' || s.estado === 'vencido' || s.estado === 'rechazado')
```
por:
```ts
.filter(s => s.estado === 'pendiente' || s.estado === 'rechazado')
```

Eliminar la entrada `vencido` del mapa `estadoTexto`:
```ts
const estadoTexto: Record<string, string> = {
  pendiente: 'Pendiente de entrega',
  rechazado: 'Rechazada',
};
```

Cambiar el color (línea ~328):
```ts
color: s.estado === 'rechazado' ? '#ef4444' : '#0095d6',
```

- [ ] **Step 2: inicio-page.component.ts — tareasReales, tareaColor, tareaLabel, resumenPorCentro**

`tareasReales` computed (línea ~60):
```ts
protected tareasReales = computed(() =>
  this.solicitudesService.solicitudes()
    .filter(s => s.estado === 'pendiente' || s.estado === 'rechazado')
);
```

`tareaColor` (línea ~106):
```ts
protected tareaColor(estado: string): string {
  if (estado === 'rechazado') return '#ef4444';
  return '#0095d6';
}
```

`tareaLabel` (línea ~112):
```ts
protected tareaLabel(estado: string): string {
  const map: Record<string, string> = {
    pendiente: 'Pendiente', rechazado: 'Rechazado',
  };
  return map[estado] ?? estado;
}
```

`resumenPorCentro` computed — eliminar la línea `vencido: sols.filter(s => s.estado === 'vencido').length,` y la key `vencido` del objeto retornado al `Map`. También ajustar el tipo `ResumenSolicitudes` si está declarado localmente (quitar campo `vencido`):

Buscar la interfaz/type `ResumenSolicitudes` en `inicio-page.component.ts`. Cambiar:
```ts
{ total: number; pct: number; pendiente: number; revision: number; aprobado: number; rechazado: number }
```
(sin `vencido`). Y en el `result.set(centroId, { ... })` eliminar la línea:
```ts
vencido:   sols.filter(s => s.estado === 'vencido').length,
```
Y en el valor por defecto de `resumenCentro()`:
```ts
?? { total: 0, pct: 50, pendiente: 0, revision: 0, aprobado: 0, rechazado: 0 }
```

- [ ] **Step 3: mi-ficha-page.component.ts — resumenCentro y resumenProyecto**

`resumenCentro` (línea ~142): quitar la rama `vencido`:
```ts
resumenCentro(centroId: string): string {
  const sols = this.solicitudesService.solicitudes()
    .filter(s => s.centro_costo_id === centroId);
  if (sols.length === 0) return 'Sin solicitudes';
  const revision = sols.filter(s => s.estado === 'revision').length;
  const base = `${sols.length} doc${sols.length !== 1 ? 's' : ''}`;
  if (revision > 0) return `${base} · ${revision} en revisión`;
  return `${base} · al día`;
}
```

`resumenProyecto` (línea ~155): ídem:
```ts
resumenProyecto(proyectoId: string): string {
  const sols = this.solicitudesService.solicitudes()
    .filter(s => s.proyecto_id === proyectoId);
  if (sols.length === 0) return 'Sin solicitudes';
  const revision = sols.filter(s => s.estado === 'revision').length;
  const base = `${sols.length} doc${sols.length !== 1 ? 's' : ''}`;
  if (revision > 0) return `${base} · ${revision} en revisión`;
  return `${base} · al día`;
}
```

- [ ] **Step 4: mi-proyecto-detalle-page.component.ts — estilo badge solicitudes**

Localizar `estadoSolStyle` (~línea 84). Cambiar:
```ts
protected estadoSolStyle(estado: string): string {
  if (estado === 'aprobado')  return 'background:rgba(34,197,94,.1);color:#16a34a';
  if (estado === 'revision')  return 'background:rgba(245,158,11,.1);color:#d97706';
  if (estado === 'rechazado') return 'background:rgba(239,68,68,.1);color:#ef4444';
  return 'background:rgba(34,33,33,.07);color:#6b7280';
}
```
(eliminar la rama `vencido` que era igual a `rechazado`)

- [ ] **Step 5: resumen-page.component.ts — filtro de alertas de solicitudes**

Localizar `PRIORIDAD` y `BADGE` (~línea 260). Cambiar:
```ts
const PRIORIDAD: Record<string, number> = { pendiente: 0, revision: 1 };
const BADGE: Record<string, { label: string; cls: string; color: string }> = {
  pendiente: { label: 'Pendiente',   cls: 'badge-orange', color: '#f59e0b' },
  revision:  { label: 'En revisión', cls: 'badge-gray',   color: '#6b7280' },
};
```

Y la línea del filter (~268):
```ts
.filter(s => s.estado === 'pendiente' || s.estado === 'revision')
```

- [ ] **Step 6: Verificar compilación**

```bash
cd front4 && npx tsc --noEmit 2>&1 | head -30
```
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add front4/src/app/layout/topbar/topbar.component.ts \
        front4/src/app/features/dashboard/pages/inicio-page.component.ts \
        front4/src/app/features/dashboard/pages/mi-ficha-page.component.ts \
        front4/src/app/features/proyectos/pages/mi-proyecto-detalle-page.component.ts \
        front4/src/app/features/dashboard/pages/resumen-page.component.ts
git commit -m "feat(front): quitar referencias a vencido de solicitudes en UI"
```

---

### Task 4: DocumentosService — añadir `proyectoId` a `documentosPorProyecto`

**Files:**
- Modify: `front4/src/app/features/documentos/documentos.service.ts`

**Interfaces:**
- Produces: `documentosPorProyecto: Signal<{ nombre: string; proyectoId: string; centroNombre: string; docs: DocumentoItem[] }[]>`

- [ ] **Step 1: Actualizar tipo de la señal**

Localizar la declaración de `documentosPorProyecto` (~línea 65) y cambiar:
```ts
readonly documentosPorProyecto = signal<{ nombre: string; proyectoId: string; centroNombre: string; docs: DocumentoItem[] }[]>([]);
```

- [ ] **Step 2: Actualizar `cargarTodosProyectos` para almacenar el ID**

La firma actual es:
```ts
cargarTodosProyectos(
  empresaId: string,
  proyectos: { _id: string; nombre: string; centro_costo_id: string }[],
  centros: { _id: string; nombre: string }[]
): void
```

En el `next` callback del `forkJoin`, añadir `proyectoId` en el `map`:
```ts
this.documentosPorProyecto.set(
  proyectos
    .map((p, i) => ({
      nombre:       p.nombre,
      proyectoId:   asId(p._id),
      centroNombre: centroMap.get(asId(p.centro_costo_id)) ?? '',
      docs: results[i].map(d =>
        this.addUrl(d, `/empresas/${empresaId}/centros/${asId(p.centro_costo_id)}/proyectos/${asId(p._id)}/documentos/${d._id}`)
      ),
    }))
    .filter(x => x.docs.length > 0)
);
```

- [ ] **Step 3: Verificar compilación**

```bash
cd front4 && npx tsc --noEmit 2>&1 | head -20
```
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add front4/src/app/features/documentos/documentos.service.ts
git commit -m "feat(front): documentosPorProyecto incluye proyectoId"
```

---

### Task 5: `inicio-page` — score documental con documentos

**Files:**
- Modify: `front4/src/app/features/dashboard/pages/inicio-page.component.ts`

**Interfaces:**
- Consumes: `DocumentosService.documentosEmpresa()`, `documentosPorCentro()`, `documentosPorProyecto()`, `documentosVencidos()`, `cargarEmpresa()`, `cargarVencidos()`, `cargarTodosCentros()`, `cargarTodosProyectos()`
- Consumes: `calcularScoreDocumental(sols, docsActivos, docsVencidos)` (Task 2)

- [ ] **Step 1: Inyectar DocumentosService**

Añadir el import al inicio del archivo:
```ts
import { DocumentosService } from '../../documentos/documentos.service';
```

Añadir en la clase (junto a los otros `inject`):
```ts
private readonly documentosService = inject(DocumentosService);
```

- [ ] **Step 2: Añadir effect de carga de documentos**

Dentro del `constructor()`, después del effect existente, añadir:
```ts
effect(() => {
  const emp     = this.consumidorContext.empresaSeleccionada();
  const centros = this.centrosDeEmpresa();
  const proyectos = this.proyectosService.proyectos()
    .filter(p => asId(p.cliente_id) === asId(emp?._id ?? ''));
  if (!emp) return;
  untracked(() => {
    this.documentosService.cargarEmpresa(emp._id);
    this.documentosService.cargarVencidos(emp._id);
    this.documentosService.cargarTodosCentros(emp._id, centros);
    this.documentosService.cargarTodosProyectos(emp._id, proyectos, centros);
  });
});
```

- [ ] **Step 3: Actualizar `scoreDocumental` computed**

Reemplazar el computed actual (~línea 77):
```ts
protected scoreDocumental = computed(() => {
  const docsActivos =
    this.documentosService.documentosEmpresa().length +
    this.documentosService.documentosPorCentro().reduce((s, g) => s + g.docs.length, 0) +
    this.documentosService.documentosPorProyecto().reduce((s, g) => s + g.docs.length, 0);
  const docsVencidos = this.documentosService.documentosVencidos().length;
  return calcularScoreDocumental(
    this.solicitudesService.solicitudes(),
    docsActivos,
    docsVencidos,
  );
});
```

- [ ] **Step 4: Verificar compilación**

```bash
cd front4 && npx tsc --noEmit 2>&1 | head -20
```
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/dashboard/pages/inicio-page.component.ts
git commit -m "feat(front): inicio-page score documental incluye documentos"
```

---

### Task 6: `mi-ficha-page` — score documental con documentos

**Files:**
- Modify: `front4/src/app/features/dashboard/pages/mi-ficha-page.component.ts`

**Interfaces:**
- Consumes: mismas señales de `DocumentosService` que Task 5
- Consumes: `calcularScoreDocumental(sols, docsActivos, docsVencidos)`

- [ ] **Step 1: Inyectar DocumentosService**

Añadir import:
```ts
import { DocumentosService } from '../../documentos/documentos.service';
```

Añadir en la clase:
```ts
private readonly documentosService = inject(DocumentosService);
```

- [ ] **Step 2: Ampliar el effect del constructor para cargar docs**

El effect actual carga `proyectosService` y `solicitudesService`. Ampliarlo:
```ts
constructor() {
  effect(() => {
    const emp = this.consumidorContext.empresaSeleccionada();
    if (emp) {
      untracked(() => {
        this.proyectosService.cargarPorEmpresa(emp._id);
        this.solicitudesService.cargar(emp._id);
        this.centrosService.cargarPorEmpresa(emp._id);
      });
    }
  });

  effect(() => {
    const emp     = this.consumidorContext.empresaSeleccionada();
    const centros = this.centrosDeEmpresa();
    const proyectos = this.proyectosDeEmpresa();
    if (!emp) return;
    untracked(() => {
      this.documentosService.cargarEmpresa(emp._id);
      this.documentosService.cargarVencidos(emp._id);
      this.documentosService.cargarTodosCentros(emp._id, centros);
      this.documentosService.cargarTodosProyectos(emp._id, proyectos, centros);
    });
  });
}
```

> Nota: `centrosService.cargarPorEmpresa` puede que ya se llame desde otro lado (ej. `centrosService` se carga en la app); si ya está cargado no hace daño volver a llamarlo.

- [ ] **Step 3: Actualizar `scoreDocumental` computed**

```ts
protected scoreDocumental = computed(() => {
  const docsActivos =
    this.documentosService.documentosEmpresa().length +
    this.documentosService.documentosPorCentro().reduce((s, g) => s + g.docs.length, 0) +
    this.documentosService.documentosPorProyecto().reduce((s, g) => s + g.docs.length, 0);
  const docsVencidos = this.documentosService.documentosVencidos().length;
  return calcularScoreDocumental(
    this.solicitudesService.solicitudes(),
    docsActivos,
    docsVencidos,
  );
});
```

- [ ] **Step 4: Verificar compilación**

```bash
cd front4 && npx tsc --noEmit 2>&1 | head -20
```
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/dashboard/pages/mi-ficha-page.component.ts
git commit -m "feat(front): mi-ficha-page score documental incluye documentos"
```

---

### Task 7: `mi-proyecto-detalle-page` — score con docs activos y vencidos del proyecto

**Files:**
- Modify: `front4/src/app/features/proyectos/pages/mi-proyecto-detalle-page.component.ts`

**Interfaces:**
- Consumes: `documentosService.documentosProyecto()`, `documentosService.documentosVencidos()`, `documentosService.cargarVencidos()`
- Consumes: `calcularScoreDocumental(sols, docsActivos, docsVencidos)`

- [ ] **Step 1: Añadir `cargarVencidos` en el effect del constructor**

Localizar el `effect()` del constructor (~línea 67). Añadir la llamada a `cargarVencidos`:
```ts
effect(() => {
  const p   = this.proyecto();
  const emp = this.empresa();
  const c   = this.centro();
  if (!p || !emp) return;
  untracked(() => {
    this.documentosService.cargar('proyecto', emp._id, c?._id, p._id);
    this.documentosService.cargarVencidos(emp._id, c?._id, asId(p._id));
  });
});
```

- [ ] **Step 2: Actualizar `scoreDoc` computed**

Localizar el computed `scoreDoc` (~línea 49). Reemplazar:
```ts
protected scoreDoc = computed(() => {
  const p = this.proyecto();
  const sols = this.solicitudesService.solicitudes().filter(s =>
    p ? asId(s.proyecto_id) === asId(p._id) : false
  );
  const docsActivos  = this.documentosService.documentosProyecto().length;
  const docsVencidos = this.documentosService.documentosVencidos().length;
  return calcularScoreDocumental(sols, docsActivos, docsVencidos);
});
```

- [ ] **Step 3: Verificar compilación**

```bash
cd front4 && npx tsc --noEmit 2>&1 | head -20
```
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add front4/src/app/features/proyectos/pages/mi-proyecto-detalle-page.component.ts
git commit -m "feat(front): mi-proyecto-detalle score incluye documentos activos y vencidos"
```

---

### Task 8: `mis-proyectos-page` — score por proyecto con docs activos

**Files:**
- Modify: `front4/src/app/features/proyectos/pages/mis-proyectos-page.component.ts`

**Interfaces:**
- Consumes: `documentosService.documentosPorProyecto()` con `proyectoId` (Task 4)
- Consumes: `calcularScoreDocumental(sols, docsActivos, 0)`

- [ ] **Step 1: Inyectar DocumentosService**

Añadir import:
```ts
import { DocumentosService } from '../../documentos/documentos.service';
```

Añadir en la clase junto a los otros inject:
```ts
private readonly documentosService = inject(DocumentosService);
```

- [ ] **Step 2: Añadir carga de docs en el effect del constructor**

El effect actual (~línea 82) solo carga proyectos y solicitudes. Ampliarlo:
```ts
constructor() {
  effect(() => {
    const emp = this.consumidorContext.empresaSeleccionada();
    if (emp) {
      this.proyectosService.cargarPorEmpresa(emp._id);
      this.solicitudesService.cargar(emp._id);
    }
  });

  effect(() => {
    const emp      = this.consumidorContext.empresaSeleccionada();
    const centros  = this.centrosService.centros()
      .filter(c => asId(c.cliente_id) === asId(emp?._id ?? ''));
    const proyectos = this.proyectos();
    if (!emp) return;
    untracked(() => {
      this.documentosService.cargarTodosProyectos(emp._id, proyectos, centros);
    });
  });
}
```

- [ ] **Step 3: Actualizar `scoreDeProyecto`**

```ts
scoreDeProyecto(proyectoId: string) {
  const sols = this.solicitudesService.solicitudes()
    .filter(s => asId(s.proyecto_id) === proyectoId);
  const grupo = this.documentosService.documentosPorProyecto()
    .find(g => g.proyectoId === proyectoId);
  const docsActivos = grupo?.docs.length ?? 0;
  return calcularScoreDocumental(sols, docsActivos, 0);
}
```

- [ ] **Step 4: Verificar compilación completa**

```bash
cd front4 && npx tsc --noEmit 2>&1 | head -30
```
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/proyectos/pages/mis-proyectos-page.component.ts
git commit -m "feat(front): mis-proyectos score por proyecto incluye documentos activos"
```

---

## Verificación final

Arrancar backend y frontend, navegar como consumidor:

1. **Solicitudes:** Intentar crear una solicitud con estado `vencido` desde admin → debe fallar con 400.
2. **Score inicio:** Con documentos subidos directamente a documentación, el % debe subir respecto a solo contar solicitudes.
3. **Score mi-ficha:** Ídem.
4. **Score detalle proyecto:** Documentos del proyecto cuentan en el score; marcar uno como vencido debe bajar el %.
5. **Score mis-proyectos:** Cada card de proyecto muestra el % incluyendo sus docs.
