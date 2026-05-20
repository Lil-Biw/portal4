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
│   └── services/api.service.ts      # URL base: http://localhost:3000/api/v1
│
├── shared/
│   ├── models/                      # Interfaces tipadas (sin `any`)
│   │   ├── cliente.model.ts         # Cliente, CreateClienteDto, UpdateClienteDto
│   │   ├── centro.model.ts          # CentroCosto, CreateCentroDto, UpdateCentroDto
│   │   ├── proyecto.model.ts        # Proyecto, CreateProyectoDto, EstadoProyecto
│   │   ├── usuario.model.ts         # Usuario, CreateUsuarioDto, RolUsuario, PermisoItem
│   │   └── status.model.ts          # Status { type: 'ok'|'error', text: string }
│   ├── components/
│   │   ├── status-banner/           # <app-status-banner [status]="...">
│   │   ├── crud-toolbar/            # <app-crud-toolbar> tabs Crear/Editar/Eliminar/Buscar
│   │   ├── stat-chip/               # <app-stat-chip [label]="..." [variant]="ok|warning|danger|neutral">
│   │   └── spider-chart/            # <app-spider-chart [labels]="..." [values]="..." [size]="260">
│   └── utils.ts                     # asId(v), encodeQuery(params)
│
├── layout/
│   ├── topbar/                      # Barra superior con toggle de modo y selector de empresa
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
│   │   ├── clientes.service.ts
│   │   ├── pages/clientes-page.component.*
│   │   └── components/
│   │       ├── cliente-form/        # dumb: emite CreateClienteDto + logoFile
│   │       └── clientes-list/       # dumb: emite seleccionado/eliminado
│   │
│   ├── centros/                     # COMPLETO
│   │   ├── centros.service.ts
│   │   ├── pages/
│   │   │   ├── centros-page.component.*       # CRUD admin
│   │   │   └── mis-centros-page.component.*   # Vista consumidor (lista + detalle inline)
│   │   └── components/...
│   │
│   ├── proyectos/                   # COMPLETO
│   │   ├── proyectos.service.ts
│   │   ├── pages/
│   │   │   ├── proyectos-page.component.*             # CRUD admin
│   │   │   ├── mis-proyectos-page.component.*         # Lista consumidor (agrupada por centro)
│   │   │   └── mi-proyecto-detalle-page.component.*   # Detalle consumidor con score, docs, solicitudes
│   │   └── components/...
│   │
│   ├── usuarios/                    # COMPLETO
│   ├── solicitudes/                 # Solo service (sin página propia)
│   │   └── solicitudes.service.ts   # EstadoSolicitud, CRUD + adjuntar archivo
│   │
│   ├── documentos/                  # COMPLETO
│   │   ├── documentos.service.ts
│   │   └── pages/
│   │       ├── documentos-page.component.*            # Shell — detecta modo, renderiza sub-componente
│   │       ├── documentos-consumidor-page.component.* # Vista consumidor completa
│   │       └── documentos-admin-page.component.*      # Vista admin completa
│   │
│   ├── mantenciones/                # PARCIAL (páginas placeholder)
│   │   └── pages/
│   │       ├── mantenciones-page.component.*      # Admin
│   │       └── mis-mantenciones-page.component.*  # Consumidor
│   │
│   ├── noticias/                    # PARCIAL (página placeholder)
│   ├── ayuda/                       # PARCIAL (página placeholder)
│   │
│   └── dashboard/
│       └── pages/
│           ├── inicio-page.component.*    # Dashboard consumidor: score, centros, tareas, novedades
│           ├── mi-ficha-page.component.*  # Ficha empresa: info, score, centros, proyectos, docs empresa
│           └── resumen-page.component.*   # Vista agregada admin
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
empresaSeleccionada = signal<Cliente | null>(null);
centroSeleccionado  = signal<CentroCosto | null>(null);
proyectoSeleccionado = signal<Proyecto | null>(null);

seleccionar(cliente)     // limpia centro y proyecto
seleccionarCentro(c)
seleccionarProyecto(p)
```

Los componentes consumidor reaccionan a `empresaSeleccionada()` para recargar sus datos.

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

  cargar(): void { ... }
  crear(dto): void { ... }
  actualizar(id, dto): void { ... }
  eliminar(id): void { ... }
  seleccionar(item): void { this.seleccionado.set(item); this.clearStatus(); }
  clearStatus(): void { this.status.set(null); }
}
```

### Feature page — patrón estándar

```ts
// Smart component: inyecta services, delega todo al service
// Template usa: CrudToolbarComponent + StatusBannerComponent + FormComponent + ListComponent
// Alterna vistas con @if por `action: CrudAction`
```

## Dependencias entre features

`Centros` necesita `ClientesService` (dropdown de empresa en el form).
`Proyectos` necesita `ClientesService` + `CentrosService`.
`Usuarios` necesita `ClientesService` + `CentrosService` (permisos por centro).
`Documentos` necesita `ClientesService` + `CentrosService` + `ProyectosService` + `SolicitudesService`.
`Resumen` necesita todos los services (solo lectura).
`MisCentros / MisProyectos / MiFicha` necesitan `SolicitudesService` para scores documentales.

→ Siempre llamar `.cargar()` en `ngOnInit` de la page para los services dependientes.

## Navegación con query params — Documentos

Desde detalle de proyecto se puede navegar a `/documentos` con filtros preseleccionados:

```ts
router.navigate(['/documentos'], {
  queryParams: { tab: 'documentacion' | 'solicitudes', centroId, proyectoId }
});
```

`DocumentosConsumidorPageComponent` lee los params en `ngOnInit` y los aplica reactivamente cuando los centros cargan.

## Convenciones de código

- **Todos los componentes son standalone** — no hay NgModule.
- **Angular 18+ control flow** (`@for`, `@if`, `@let`) — preferir sobre `*ngFor`/`*ngIf`. No mezclar en el mismo componente.
- **Signals** para todo el estado reactivo — no usar `BehaviorSubject` ni `Subject`.
- **`asId()`** obligatorio al comparar ObjectIds entre entidades (evita falsos negativos por tipo `string | ObjectId`).
- Estilos globales en `src/styles.css` (clases `.card`, `.form-grid`, `.field`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-sm`, `.list`, `.empty`).
- Estilos de componente en `styles: []` inline cuando son cortos; archivo `.css` para componentes con estilos extensos.
- **Componentes grandes de una sola página** (como documentos) se dividen por modo en sub-componentes con un shell que detecta el modo.

## Guía para el agente IA

1. **Agregar una nueva entidad**: crear carpeta en `features/`, seguir el patrón de `clientes/` exactamente. Agregar la ruta en `app.routes.ts` y el item en `sidebar.component.ts`.

2. **Agregar un campo a un formulario**: actualizar el modelo en `shared/models/`, el DTO, el método `empty()` del form component, el HTML del form, y el método `actualizar()` de la page si filtra campos.

3. **Agregar un shared component**: va en `shared/components/` solo si lo usan 2+ features. Si es específico de una feature, va en `features/<nombre>/components/`.

4. **NO usar `any`** — si la respuesta de la API no encaja con el modelo, extender la interfaz.

5. **NO inyectar services en componentes dumb** — toda la lógica HTTP va en el service; los componentes dumb solo reciben datos por `@Input` y emiten eventos por `@Output`. La excepción es `ChangeDetectorRef` para callbacks fuera de la zona Angular (ej. `FileReader.onload`).

6. **Permisos de usuario**: al crear/actualizar un usuario, el payload incluye `permisos: PermisoItem[]` construido desde `UsuariosService.permisosSeleccionados()`.

7. **Documentos**: el backend acepta PDF y otros formatos. La validación está en `DocumentosService.subir()`. El backend espera multipart/form-data con campo `archivo`. Los documentos se organizan por carpetas `empresa/centro/proyecto` en el servidor.

8. **Solicitudes**: entidad independiente (no confundir con documentos). Tienen estado: `pendiente → revision → aprobado/rechazado/vencido`. El consumidor puede adjuntar archivos a solicitudes pendientes/rechazadas/vencidas.
