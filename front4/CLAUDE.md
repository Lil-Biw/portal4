# portal4 — Portal de Clientes ECLARITI

Angular 21 standalone con arquitectura limpia. Portal con dos modos: **admin** (gestión interna) y **consumidor** (vista de cliente).

## Comandos

```bash
npm start          # ng serve → http://localhost:4200
npm run build      # ng build (producción)
npm test           # Vitest
```

## Estructura de carpetas

```
src/app/
├── core/
│   └── services/api.service.ts      # URL base: inyectada desde environment.apiUrl
│                                     # ADVERTENCIA: environment.prod.ts apunta a localhost:3000
│                                     # Usar set-env.js + variable API_URL en build de producción
│
├── shared/
│   ├── models/                      # Interfaces tipadas (sin `any`)
│   │   ├── cliente.model.ts         # Cliente, CreateClienteDto, UpdateClienteDto
│   │   ├── centro.model.ts          # CentroCosto, CreateCentroDto, UpdateCentroDto
│   │   ├── proyecto.model.ts        # Proyecto, CreateProyectoDto, EstadoProyecto
│   │   ├── usuario.model.ts         # Usuario, CreateUsuarioDto, RolUsuario, PermisoItem
│   │   ├── mantencion.model.ts      # Mantencion, TipoMantencion, DTOs
│   │   └── status.model.ts          # Status { type: 'ok'|'error', text: string }
│   ├── components/
│   │   ├── status-banner/           # <app-status-banner [status]="...">
│   │   ├── crud-toolbar/            # <app-crud-toolbar> tabs Crear/Editar/Eliminar/Buscar
│   │   ├── stat-chip/               # <app-stat-chip [label]="..." [variant]="ok|warning|danger|neutral">
│   │   └── spider-chart/            # <app-spider-chart [labels]="..." [values]="..." [size]="260">
│   └── utils.ts                     # asId(v), encodeQuery(params), toDateKey(d)
│
├── layout/
│   ├── topbar/                      # Barra superior: toggle modo, selector empresa (consumidor), campana notificaciones
│   ├── sidebar/                     # Nav con RouterLink — muestra sub-items contextuales (centro/proyecto activo)
│   └── main-layout/                 # Shell: topbar + sidebar + <router-outlet>
│
├── profile/
│   ├── profile.service.ts           # Signal + localStorage, modos admin/consumidor
│   ├── profile.types.ts             # type ProfileMode = 'admin' | 'consumidor'
│   └── consumidor-context.service.ts  # empresaSeleccionada, centroSeleccionado, proyectoSeleccionado (signals)
│
├── features/
│   ├── clientes/                    # COMPLETO — CRUD empresas (admin)
│   ├── centros/                     # COMPLETO — CRUD centros (admin) + vista consumidor con docs y solicitudes
│   ├── proyectos/                   # COMPLETO — CRUD proyectos (admin) + detalle consumidor
│   ├── usuarios/                    # COMPLETO
│   ├── solicitudes/                 # Solo service (sin página propia)
│   │   └── solicitudes.service.ts   # EstadoSolicitud, CRUD + adjuntar archivo
│   ├── documentos/                  # COMPLETO — shell detecta modo, sub-componentes por modo
│   ├── mantenciones/                # COMPLETO
│   │   ├── mantenciones.service.ts
│   │   ├── tipos-mantencion.service.ts
│   │   └── pages/
│   │       ├── mantenciones-page.component.*      # Admin: calendario mes/semana + CRUD modal + tipos + filtro empresa
│   │       └── mis-mantenciones-page.component.*  # Consumidor: calendario read-only filtrado por empresa del contexto
│   ├── noticias/                    # Placeholder
│   ├── ayuda/                       # Placeholder
│   └── dashboard/
│       └── pages/
│           ├── inicio-page.component.*    # Dashboard consumidor
│           ├── mi-ficha-page.component.*  # Ficha empresa consumidor
│           └── resumen-page.component.*   # Vista agregada admin (incluye mantenciones)
│
├── app.routes.ts                    # Lazy routes → MainLayout → feature pages
├── app.config.ts                    # provideHttpClient, provideRouter
└── app.ts                           # Solo <router-outlet>
```

## Rutas

| URL | Componente | Modo |
|---|---|---|
| `/` | redirect → `/inicio` | — |
| `/inicio` | InicioPageComponent | consumidor |
| `/mi-ficha` | MiFichaPageComponent | consumidor |
| `/mis-centros` | MisCentrosPageComponent | consumidor |
| `/mis-proyectos` | MisProyectosPageComponent | consumidor |
| `/mis-proyectos/:id` | MiProyectoDetallePageComponent | consumidor |
| `/mis-mantenciones` | MisMantencionesPageComponent | consumidor |
| `/empresa` | ClientesPageComponent | admin |
| `/centros` | CentrosPageComponent | admin |
| `/proyectos` | ProyectosPageComponent | admin |
| `/mantenciones` | MantencionesPageComponent | admin |
| `/usuarios` | UsuariosPageComponent | admin |
| `/documentos` | DocumentosPageComponent (shell) | ambos |
| `/noticias` | NoticiasPageComponent | ambos |
| `/ayuda` | AyudaPageComponent | ambos |
| `/resumen` | ResumenPageComponent | admin |

## Sidebar — ítems por modo

**Admin:** Empresas · Centro de costos · Proyectos · Mantenciones · Documentos · Noticias · Usuarios · Ayuda · Resumen general

**Consumidor:** Inicio · Mi ficha · Centro de costos · Proyectos · Mantenciones · Documentos · Noticias · Ayuda

El sidebar muestra sub-ítems contextuales bajo el ítem activo cuando hay un centro o proyecto seleccionado en `ConsumidorContextService`.

## ConsumidorContextService

Mantiene el contexto global del consumidor mediante signals:

```ts
empresaSeleccionada  = signal<Cliente | null>(null);
centroSeleccionado   = signal<CentroCosto | null>(null);
proyectoSeleccionado = signal<Proyecto | null>(null);

seleccionar(cliente)      // limpia centro y proyecto
seleccionarCentro(c)
seleccionarProyecto(p)
```

Los componentes consumidor reaccionan a `empresaSeleccionada()` para filtrar o recargar sus datos.

## Score documental

Patrón reutilizado en inicio, mi-ficha, mis-centros y detalle de proyecto:
- Porcentaje: `aprobados / total * 100`
- Barra de progreso con degradado azul→verde
- 5 recuadros de estado: Aprobados (verde) · Revisión (amarillo) · Vencidos (rojo) · Rechazados (rosa) · Pendiente (azul claro)
- `<app-stat-chip>` con variante `ok/warning/danger` según el porcentaje

## Patrón de feature (aplicar igual en todos)

```
features/<nombre>/
├── <nombre>.service.ts        ← HTTP + signals de estado (sin `any`)
├── pages/
│   └── <nombre>-page.component.*  ← SMART: inyecta services, orquesta
└── components/
    ├── <nombre>-form/         ← DUMB: @Input inicial, @Output submitted
    └── <nombre>s-list/        ← DUMB: @Input items, @Output seleccionado/eliminado
```

### Feature service — patrón estándar

```ts
@Injectable({ providedIn: 'root' })
export class XxxService {
  readonly items        = signal<Xxx[]>([]);
  readonly seleccionado = signal<Xxx | null>(null);
  readonly status       = signal<Status | null>(null);
  readonly loading      = signal(false);

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }

  cargar(): void { this.loading.set(true); /* GET → .set(data); loading.set(false) en next y error */ }
  crear(dto): void { /* POST → update signal + status 'ok' */ }
  actualizar(id, dto): void { /* PUT → map signal + status 'ok' */ }
  eliminar(id): void { /* DELETE → filter signal + status 'ok' */ }
  clearStatus(): void { this.status.set(null); }
}
```

**Nota:** `MantencionesService` y `TiposMantencionService` no tienen señal `seleccionado` — el estado de edición se maneja en el componente vía `editingId` + `form` (patrón modal, no patrón detalle).

### Feature page — patrón estándar

```ts
// Smart component: inyecta services, delega todo al service
// Template usa: CrudToolbarComponent + StatusBannerComponent + FormComponent + ListComponent
// Alterna vistas con @if por `action: CrudAction`
```

### Patrón modal con cierre automático en éxito

Para páginas con modal de creación/edición, cerrar el modal reactivamente cuando el server confirma:

```ts
constructor() {
  effect(() => {
    if (this.service.status()?.type === 'ok' && this.showModal()) {
      this.cerrarModal();
    }
  });
}
```

Agregar `<app-status-banner>` dentro del modal para mostrar errores sin cerrarlo.
`abrirCrear()` y `abrirEditar()` deben llamar `service.clearStatus()` al abrir.

## Patrón de calendario — mantenciones

**Deuda técnica:** La lógica de calendario (~94 líneas) está duplicada entre `mantenciones-page.component.ts` y `mis-mantenciones-page.component.ts`. El algoritmo de relleno de celdas ya diverge sutilmente. Antes de modificar el calendario, considerar extraer un `CalendarService` o componente `<app-calendar>` compartido.

El calendario (vista mes y semana) está implementado en `mantenciones-page.component.ts` y `mis-mantenciones-page.component.ts`.

- **`toDateKey(d: Date): string`** — exportada desde `shared/utils.ts`. Genera `YYYY-MM-DD` para comparar fechas.
- **`mantencionesEnDia(date)`** — siempre usa `mantencionesFiltradas()`, nunca `service.mantenciones()` directamente.
- **`filtroEmpresaId`** (admin) — signal que filtra el calendario por empresa. `centroIdsPorEmpresa` computed calcula el Set de IDs, `mantencionesFiltradas` computed aplica el filtro.
- **Consumidor** — filtra automáticamente por `ctx.empresaSeleccionada()` vía `centroIdsPorEmpresa` computed. Sin UI de filtro.
- **CSS compartido** — `mis-mantenciones-page.component.ts` usa `styleUrl: './mantenciones-page.component.css'`.

## Topbar — notificaciones

La campana de notificaciones (solo modo consumidor) está en `TopbarComponent`:

- Filtra mantenciones por empresa seleccionada (igual que el calendario consumidor — vía `centroIdsPorEmpresa` computed).
- Muestra mantenciones próximas en 7 días + solicitudes vencidas/rechazadas.
- El dropdown usa `position: absolute; top: calc(100% + 8px); right: 0` relativo a `.notif-wrapper` (z-index 1002).
- Backdrop en `position: fixed; z-index: 1001` para cerrar al hacer clic fuera.

## Backend — respuestas paginadas vs. array plano

Los services del frontend manejan ambos formatos de respuesta:

```ts
// CentrosService, ClientesService, ProyectosService, UsuariosService
this.http.get<{ data: T[] } | T[]>(...).subscribe({
  next: res => this.items.set(Array.isArray(res) ? res : res.data),
});
```

`SolicitudesService`, `MantencionesService`, `TiposMantencionService` reciben siempre array plano.

## Solicitudes — campo empresa_id

El campo FK de cliente en solicitudes se llama **`empresa_id`** (no `cliente_id`). Es intencional y consistente con el backend. No confundir con otros módulos.

## Dependencias entre features

```
Centros       → ClientesService
Proyectos     → ClientesService + CentrosService
Usuarios      → ClientesService + CentrosService
Documentos    → ClientesService + CentrosService + ProyectosService + SolicitudesService
Mantenciones  → TiposMantencionService + CentrosService + ClientesService
Topbar        → ClientesService + CentrosService + MantencionesService + TiposMantencionService + SolicitudesService
Resumen       → todos los services (solo lectura)
MisCentros/MisProyectos/MiFicha → SolicitudesService + DocumentosService
```

→ Siempre llamar `.cargar()` en `ngOnInit` para los services dependientes.

## Navegación con query params — Documentos

```ts
router.navigate(['/documentos'], {
  queryParams: { tab: 'documentacion' | 'solicitudes', centroId, proyectoId }
});
```

`DocumentosConsumidorPageComponent` lee los params en `ngOnInit` y los aplica reactivamente.

## Convenciones de código

- **Todos los componentes son standalone** — no hay NgModule.
- **Angular 18+ control flow** (`@for`, `@if`, `@let`) — nunca `*ngFor`/`*ngIf`. No mezclar.
- **Signals** para todo el estado reactivo — no usar `BehaviorSubject` ni `Subject`.
- **`asId()`** obligatorio al comparar ObjectIds entre entidades.
- **`toDateKey()`** de `shared/utils.ts` para convertir `Date` a `YYYY-MM-DD`. No duplicar en componentes.
- Estilos globales en `src/styles.css`: `.card`, `.form-grid`, `.field`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-sm`, `.list`, `.empty`.
- Estilos de componente: `styles: []` inline si son cortos; archivo `.css` para extensos.
- **Sin `any`** — si la API devuelve algo no tipado, extender la interfaz.

## Problemas de seguridad conocidos

Ver `PORTAL4_problemas.md` (raíz del repo) para el listado completo. Los más relevantes para el frontend:

- **JWT en localStorage** — `auth.service.ts` guarda token en `localStorage`. Vulnerable a XSS.
- **Interceptor sin 401** — `auth.interceptor.ts` no detecta token expirado ni redirige al login.
- **`environment.prod.ts`** — apunta a `localhost:3000`. Corregir antes de cualquier deploy.
- **Modo admin/consumidor** — `profile.service.ts` usa `localStorage`; manipulable desde DevTools. Las rutas admin siguen protegidas por `soloAdminGuard` (seguro), pero la lógica UI que depende solo de `profile.mode()` puede ser engañada.
- **`scoreDeProyecto()`** en `mis-proyectos-page` — método ordinario llamado en el template; recalcula en cada change detection. Convertir a `computed` antes de agregar más lógica.
- **`effect()` sin cleanup** en `documentos-consumidor-page.component.ts` — inyectar `DestroyRef` al agregar nuevos efectos.

## Guía para el agente IA

1. **Agregar una nueva entidad**: crear carpeta en `features/`, seguir el patrón de `clientes/`. Ruta en `app.routes.ts`, ítem en `sidebar.component.ts`.

2. **Agregar un campo**: actualizar modelo en `shared/models/`, el DTO, el método `empty()` del form, el HTML, y `actualizar()` de la page si filtra campos.

3. **Shared component**: en `shared/components/` solo si lo usan 2+ features. Si es de una sola feature, va en `features/<nombre>/components/`.

4. **NO usar `any`** — extender la interfaz si la respuesta de la API no encaja.

5. **NO inyectar services en componentes dumb** — toda la lógica HTTP va en el service.

6. **Documentos**: backend espera multipart/form-data con campo `archivo`. Usar `DocumentosService.subir()` siempre.

7. **Solicitudes**: estado `pendiente → revision → aprobado/rechazado/vencido`. El consumidor puede adjuntar archivos a solicitudes pendientes/rechazadas/vencidas.

8. **Mantenciones**: el filtro de empresa es client-side (computed). No recargar el service al cambiar empresa — el computed reacciona automáticamente.

9. **Error handling en services**: siempre usar `private setError(err)` que extrae `err?.error?.message` del backend. Nunca texto hardcodeado genérico.
