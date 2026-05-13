# portal3 — Portal de Clientes ECLARITI

Angular 21 standalone con arquitectura limpia. Reescritura de `portal2/front` con separación correcta de responsabilidades.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Angular 21 standalone |
| Lenguaje | TypeScript 5.9 |
| Estilos | CSS global (`src/styles.css`) + inline styles |
| Testing | Vitest (vía `@angular/build:unit-test`) |
| HTTP | `HttpClient` con `withFetch()` |
| Routing | `provideRouter` con lazy loading y `withComponentInputBinding` |
| Estado | Signals (sin RxJS BehaviorSubject) |
| Forms | Template-driven con `ngModel` (FormsModule) |

## Comandos

```bash
npm start        # ng serve → http://localhost:4200
npm run build    # ng build (producción)
npm test         # ng test → Vitest
```

## Estructura raíz

```
src/
├── main.ts                       # bootstrapApplication(App, appConfig)
├── styles.css                    # Variables CSS, .card, .form-grid, .field, .btn-primary/ghost/danger, .list, .empty, .pct-badge
│
└── app/
    ├── app.ts                    # <router-outlet /> (root standalone)
    ├── app.html                  # Placeholder (reemplazar con el router)
    ├── app.css                   # Placeholder
    ├── app.spec.ts               # Smoke test
    ├── app.config.ts             # provideRouter + provideHttpClient + error listeners
    ├── app.routes.ts             # Lazy routes → MainLayout → feature pages
    │
    ├── core/
    │   └── services/api.service.ts    # ApiService.base = http://localhost:3000/api/v1, método url(path)
    │
    ├── shared/
    │   ├── models/
    │   │   ├── cliente.model.ts       # Cliente, CreateClienteDto, UpdateClienteDto, Direccion
    │   │   ├── centro.model.ts        # CentroCosto, CreateCentroDto, UpdateCentroDto, DocumentoRef
    │   │   ├── proyecto.model.ts      # Proyecto, CreateProyectoDto, UpdateProyectoDto, EstadoProyecto, DocumentoRef
    │   │   ├── usuario.model.ts       # Usuario, CreateUsuarioDto, UpdateUsuarioDto, RolUsuario, PermisoAcceso, PermisoItem
    │   │   └── status.model.ts        # Status { type: 'ok'|'error', text: string }
    │   ├── components/
    │   │   ├── crud-toolbar/          # <app-crud-toolbar [entity] [action] [actions] (actionChange)>
    │   │   │                          #   CrudAction = 'crear' | 'editar' | 'eliminar' | 'buscar'
    │   │   ├── status-banner/         # <app-status-banner [status]>
    │   │   └── stat-chip/             # <app-stat-chip [label] [variant: ChipVariant]>
    │   │                              #   ChipVariant = 'ok' | 'warning' | 'danger' | 'neutral'
    │   └── utils.ts                   # asId(v): string, encodeQuery(params): string
    │
    ├── layout/
    │   ├── topbar/                    # Barra con brand, mode chip y toggle admin/consumidor
    │   ├── sidebar/                   # Nav items según el modo (admin: 6 items, consumidor: 4 items)
    │   └── main-layout/               # Grid layout: topbar + (sidebar | router-outlet)
    │
    ├── profile/
    │   ├── profile.types.ts           # type ProfileMode = 'admin' | 'consumidor'
    │   └── profile.service.ts         # Signal + localStorage, toggleMode()
    │
    └── features/
        ├── clientes/                 # CRUD completo de empresas
        ├── centros/                  # CRUD completo de centros de costos
        ├── proyectos/                # CRUD completo de proyectos
        ├── usuarios/                 # CRUD completo de usuarios
        ├── documentos/               # Upload/list/delete de PDFs por contexto
        └── dashboard/
            ├── mi-ficha-page         # Vista consumidor (datos mock)
            └── resumen-page          # Vista agregada admin
```

## Rutas

| URL | Componente | Modo requerido |
|-----|-----------|----------------|
| `/` | redirect → `/mi-ficha` | — |
| `/mi-ficha` | `MiFichaPageComponent` | consumidor |
| `/empresa` | `ClientesPageComponent` | admin |
| `/centros` | `CentrosPageComponent` | admin |
| `/proyectos` | `ProyectosPageComponent` | admin |
| `/usuarios` | `UsuariosPageComponent` | admin |
| `/documentos` | `DocumentosPageComponent` | ambos |
| `/resumen` | `ResumenPageComponent` | admin |

Todas las rutas son lazy-loaded dentro de `MainLayoutComponent`.

## API endpoints (backend en localhost:3000/api/v1)

| Recurso | Endpoint |
|---------|----------|
| Clientes | `/clientes` |
| Centros de costo | `/centros-costos` |
| Proyectos | `/proyectos` |
| Usuarios | `/usuarios` |
| Permisos | `/permisos/usuario/:id` |
| Documentos listar | `/documentos/listar?tipo=...&empresa_nombre=...` |
| Documentos upload | `/documentos/upload` (POST multipart, campo `archivo`) |
| Documentos eliminar | `/documentos/eliminar/:filename?tipo=...` |

## Modelos de datos

### Cliente
```ts
Cliente { _id, razon_social, rut, email_contacto, telefono?, direccion?: Direccion, activo, creado_en?, actualizado_en? }
CreateClienteDto { razon_social, rut, email_contacto, telefono?, direccion?: Direccion }
Direccion { calle?, ciudad?, region?, pais? }
```

### CentroCosto
```ts
CentroCosto { _id, cliente_id, codigo, nombre, descripcion?, ubicacion_*?, activo, documentos?: DocumentoRef[], creado_en?, actualizado_en? }
CreateCentroDto { cliente_id, codigo, nombre, descripcion?, ubicacion_*? }
```

### Proyecto
```ts
Proyecto { _id, centro_costo_id, cliente_id, codigo, nombre, descripcion?, estado: EstadoProyecto, fecha_inicio?, fecha_fin?, documentos?: DocumentoRef[], creado_por?, creado_en?, actualizado_en? }
EstadoProyecto = 'borrador' | 'activo' | 'cerrado'
CreateProyectoDto { centro_costo_id, cliente_id, codigo, nombre, descripcion?, estado?, fecha_inicio?, fecha_fin? }
```

### Usuario
```ts
Usuario { _id, cliente_id, nombre, email, rol: RolUsuario, permiso_acceso: PermisoAcceso, activo, ultimo_acceso?, creado_en?, actualizado_en? }
RolUsuario = 'admin_cliente' | 'usuario'
PermisoAcceso = 'ver' | 'editar'
CreateUsuarioDto { cliente_id, nombre, email, password, rol?, permiso_acceso? }
UpdateUsuarioDto { nombre?, email?, rol?, permiso_acceso?, permisos?: PermisoItem[] }
PermisoItem { centro_costo_id, tipo: PermisoAcceso }
```

### DocumentoItem (extensión local en DocumentosService)
```ts
DocumentoItem { nombre, url, tipo_mime, tamano_bytes? }
DocTipo = 'empresa' | 'centro' | 'proyecto'
```

## Patrón de feature (template estándar)

Cada feature sigue esta estructura exacta:

```
features/<nombre>/
├── <nombre>.service.ts            ← HTTP + signals
├── pages/
│   └── <nombre>-page.component.*  ← SMART: inyecta services, orquesta
└── components/
    ├── <nombre>-form/             ← DUMB: @Input initial, @Input clientes/centros (dropdowns), @Output submitted
    └── <nombre>s-list/            ← DUMB: @Input items, @Input seleccionadoId, @Output seleccionado/eliminado
```

### Feature service — patrón exacto

```ts
@Injectable({ providedIn: 'root' })
export class XxxService {
  readonly items       = signal<Xxx[]>([]);
  readonly seleccionado = signal<Xxx | null>(null);
  readonly status      = signal<Status | null>(null);
  readonly loading     = signal(false);

  cargar(): void {
    this.loading.set(true);
    this.http.get<{ data: Xxx[] } | Xxx[]>(this.api.url('/endpoint')).subscribe({
      next: (res) => { this.items.set(Array.isArray(res) ? res : res.data); this.loading.set(false); },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  crear(dto): void {
    this.http.post<Xxx>(this.api.url('/endpoint'), dto).subscribe({
      next: () => { this.status.set({ type: 'ok', text: '...creado correctamente' }); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id, dto): void {
    this.http.put<Xxx>(this.api.url(`/endpoint/${id}`), dto).subscribe({
      next: () => { this.status.set({ type: 'ok', text: '...actualizado' }); this.seleccionado.set(null); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  eliminar(id): void {
    this.http.delete(this.api.url(`/endpoint/${id}`)).subscribe({
      next: () => { this.status.set({ type: 'ok', text: '...eliminado' }); this.seleccionado.set(null); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  seleccionar(item): void { this.seleccionado.set(item); this.clearStatus(); }
  clearStatus(): void { this.status.set(null); }
  private setError(err): void { this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' }); }
}
```

### Feature page — patrón exacto

```ts
// Inyecta el service propio + services dependientes
ngOnInit(): void {
  this.service.cargar();
  // Llamar .cargar() de services dependientes
}

// Template usa: CrudToolbarComponent + StatusBannerComponent + FormComponent + ListComponent
// Alterna vistas según `action: CrudAction` con *ngIf
// Form: submit → crear(dto) o actualizar(dto)
// List: seleccionado → service.seleccionar(item), eliminado → service.eliminar(id)
```

## Dependencias entre features

| Feature | Dependencias (inyecta services) |
|---------|-------------------------------|
| Centros | `ClientesService` (dropdown empresa en form) |
| Proyectos | `ClientesService` + `CentrosService` (dropdowns empresa→centro) |
| Usuarios | `ClientesService` + `CentrosService` (dropdown empresa + permisos por centro) |
| Documentos | `ClientesService` + `CentrosService` + `ProyectosService` (selectores de contexto) |
| Resumen | Todos los services (solo lectura, sin CRUD) |

→ Siempre llamar `.cargar()` en `ngOnInit` de la page para cada service dependiente.

## Convenciones de código

1. **Componentes standalone** — no hay NgModule. `bootstrapApplication` en `main.ts`.
2. **Control flow**: usar `*ngFor`/`*ngIf` de CommonModule (no mezclar con `@for`/`@if` en el mismo componente).
3. **Signals** para todo estado reactivo — no usar `BehaviorSubject` ni `Subject`.
4. **`asId()`** obligatorio al comparar ObjectIds entre entidades.
5. **Sin `any`** — si la respuesta de API no encaja, extender la interfaz.
6. **Componentes dumb**: no inyectan services, solo `@Input` y `@Output`.
7. **CSS**: clases globales en `src/styles.css` (`.card`, `.form-grid`, `.field`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.list`, `.empty`). Estilos inline en componentes pequeños; archivo `.css` separado para componentes grandes.
8. **Formularios**: template-driven con `FormsModule` y `ngModel`. No se usa ReactiveFormsModule.

## Shared components

### `<app-crud-toolbar>`
- `@Input entity: string` — título (ej. "Empresa")
- `@Input action: CrudAction` — acción activa (default 'crear')
- `@Input actions: CrudAction[]` — botones a mostrar (default todos)
- `@Output actionChange: CrudAction`
- Renderiza botones: Crear / Editar / Eliminar / Buscar

### `<app-status-banner>`
- `@Input status: Status | null`
- Muestra texto con estilo verde (ok) o rojo (error)

### `<app-stat-chip>`
- `@Input label: string`
- `@Input variant: ChipVariant` = `'ok' | 'warning' | 'danger' | 'neutral'`

## Casos especiales

### Usuarios: permisos por centro
- `UsuariosService.permisosSeleccionados` signal<string[]> — IDs de centros con permiso
- `UsuariosService.togglePermiso(centroId, checked)` — agrega/remueve
- `UsuariosService.cargarPermisos(usuarioId)` — GET `/permisos/usuario/:id`
- Al crear: `this.service.crear(dto, permisos)` con `PermisoItem[]`
- Al actualizar: page construye `UpdateUsuarioDto` filtrando permisos según centros disponibles
- Form emite `UsuarioFormOutput { dto: CreateUsuarioDto, permisos: PermisoItem[] }`

### Documentos: solo PDF
- Validación en `DocumentosService.subir()`: `file.type !== 'application/pdf'` → error
- Backend espera `multipart/form-data` con campo `archivo`
- Descarga via `window.open(url, '_blank')`
- Tres secciones independientes: empresa, centro, proyecto (cada una con su signal de documentos y status)

### Dashboard consumidor (mi-ficha)
- Datos completamente mock (hardcodeados en el componente)
- Sin llamadas HTTP
- Muestra: centros con % de avance, métricas, tareas, mantenciones, score documental, novedades
- Usa `@for` (Angular 17+ control flow) — es el único componente que mezcla patrón de template

### Profile mode
- `ProfileService.mode` signal → `'admin' | 'consumidor'`
- Persiste en `localStorage` con key `portal3_profile_mode`
- Sidebar cambia items según modo
- Topbar muestra `modeLabel` y botón toggle
- `MainLayoutComponent` inyecta `ProfileService` y pasa `mode` a topbar y sidebar

## UI/UX Notes
- Layout grid: `grid-template-columns: 220px 1fr` (sidebar + content)
- Layout CSS: `display:grid; grid-template-rows:auto 1fr; height:100vh`
- Fondo general: `#f0f4f8`
- Acento: `#0095d6`
- Bordes redondeados (8px, 12px, 14px) con sombras suaves
- Diseño glassmorphism sutil en topbar y sidebar (backdrop-filter, rgba backgrounds)

## Tests
- Solo existe `app.spec.ts` con smoke test básico
- Usar `ng test` (Vitest via `@angular/build:unit-test`)
- Sin tests de componentes ni servicios aún
