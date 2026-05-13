# portal3 — Portal de Clientes ECLARITI (refactor)

Angular 21 standalone con arquitectura limpia. Reescritura de `portal2/front` con separación correcta de responsabilidades.

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
│   │   └── stat-chip/               # <app-stat-chip [label]="..." [variant]="...">
│   └── utils.ts                     # asId(v), encodeQuery(params)
│
├── layout/
│   ├── topbar/                      # Barra superior con toggle de modo
│   ├── sidebar/                     # Nav con RouterLink — no emite strings
│   └── main-layout/                 # Shell: topbar + sidebar + <router-outlet>
│
├── profile/
│   ├── profile.service.ts           # Signal + localStorage, modos admin/consumidor
│   └── profile.types.ts             # type ProfileMode = 'admin' | 'consumidor'
│
├── features/
│   ├── clientes/                    # COMPLETO
│   │   ├── clientes.service.ts
│   │   ├── pages/clientes-page.component.*
│   │   └── components/
│   │       ├── cliente-form/        # dumb: emite CreateClienteDto
│   │       └── clientes-list/       # dumb: emite seleccionado/eliminado
│   │
│   ├── centros/                     # COMPLETO (igual estructura que clientes)
│   ├── proyectos/                   # COMPLETO
│   ├── usuarios/                    # COMPLETO
│   ├── documentos/                  # COMPLETO (upload/list/delete)
│   └── dashboard/
│       └── pages/
│           ├── mi-ficha-page.*      # Dashboard consumidor (datos mock)
│           └── resumen-page.*       # Vista agregada admin
│
├── app.routes.ts                    # Lazy routes → MainLayout → feature pages
├── app.config.ts                    # provideHttpClient, provideRouter
└── app.ts                           # Solo <router-outlet>
```

## Rutas

| URL | Componente | Modo |
|---|---|---|
| `/` | redirect → `/mi-ficha` | — |
| `/mi-ficha` | MiFichaPageComponent | consumidor |
| `/empresa` | ClientesPageComponent | admin |
| `/centros` | CentrosPageComponent | admin |
| `/proyectos` | ProyectosPageComponent | admin |
| `/usuarios` | UsuariosPageComponent | admin |
| `/documentos` | DocumentosPageComponent | ambos |
| `/resumen` | ResumenPageComponent | admin |

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
  readonly items       = signal<Xxx[]>([]);
  readonly seleccionado = signal<Xxx | null>(null);
  readonly status      = signal<Status | null>(null);
  readonly loading     = signal(false);

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
// Alterna vistas con *ngIf por `action: CrudAction`
```

## Dependencias entre features

`Centros` necesita `ClientesService` (dropdown de empresa en el form).
`Proyectos` necesita `ClientesService` + `CentrosService`.
`Usuarios` necesita `ClientesService` + `CentrosService` (permisos por centro).
`Documentos` necesita `ClientesService` + `CentrosService` + `ProyectosService`.
`Resumen` necesita todos los services (solo lectura).

→ Siempre llamar `.cargar()` en `ngOnInit` de la page para los services dependientes.

## Convenciones de código

- **Todos los componentes son standalone** — no hay NgModule.
- **Angular 17+ control flow** (`@for`, `@if`) disponible pero las listas usan `*ngFor`/`*ngIf` de CommonModule por consistencia. Elegir uno y no mezclar en el mismo componente.
- **Signals** para todo el estado reactivo — no usar `BehaviorSubject` ni `Subject`.
- **`asId()`** obligatorio al comparar ObjectIds entre entidades.
- Estilos globales en `src/styles.css` (clases `.card`, `.form-grid`, `.field`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.list`, `.empty`).
- Estilos de componente en `styles: []` inline cuando son cortos; archivo `.css` para componentes con estilos extensos.

## Guía para el agente IA

1. **Agregar una nueva entidad**: crear carpeta en `features/`, seguir el patrón de `clientes/` exactamente. Agregar la ruta en `app.routes.ts` y el item en `sidebar.component.ts`.

2. **Agregar un campo a un formulario**: actualizar el modelo en `shared/models/`, el DTO, el método `empty()` del form component, el HTML del form, y el método `actualizar()` de la page si filtra campos.

3. **Agregar un shared component**: va en `shared/components/` solo si lo usan 2+ features. Si es específico de una feature, va en `features/<nombre>/components/`.

4. **NO usar `any`** — si la respuesta de la API no encaja con el modelo, extender la interfaz.

5. **NO inyectar services en componentes dumb** — toda la lógica HTTP va en el service; los componentes dumb solo reciben datos por `@Input` y emiten eventos por `@Output`.

6. **Permisos de usuario**: al crear/actualizar un usuario, el payload incluye `permisos: PermisoItem[]` construido desde `UsuariosService.permisosSeleccionados()`.

7. **Documentos**: solo se aceptan PDF. La validación está en `DocumentosService.subir()`. El backend espera multipart/form-data con campo `archivo`.
