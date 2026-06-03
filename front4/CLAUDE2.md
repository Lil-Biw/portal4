# portal4 — Portal de Clientes ECLARITI (actualizado 2026-06-02)

Angular 21 standalone con arquitectura limpia. Portal con dos modos: **admin** y **consumidor**.
Nombre en package.json: `portal3` (legacy — no renombrar, rompe paths de build).

## Comandos

```bash
npm start          # ng serve → http://localhost:4200
npm run build      # node scripts/set-env.js && ng build (requiere API_URL en producción)
npm test           # Vitest
```

## Build de producción

`scripts/set-env.js` inyecta `API_URL` en `src/environments/environment.prod.ts` antes del build:
- Si `NODE_ENV=production` y `API_URL` no está definida → **falla con exit 1** (intencional)
- Si `NODE_ENV` != production y no hay `API_URL` → usa `http://localhost:3000/api/v1` como fallback
- Output directory real: `dist/portal3/browser` (definido en `vercel.json` del frontend)

## Estructura de carpetas

```
src/app/
├── core/
│   ├── services/api.service.ts            # URL base desde environment.apiUrl
│   └── interceptors/auth.interceptor.ts   # Bearer token + logout automático en 401
│
├── shared/
│   ├── models/
│   │   ├── activo.model.ts                # Activo, CreateActivoDto, UpdateActivoDto
│   │   ├── centro.model.ts                # CentroCosto, DocumentoRef, DTOs
│   │   ├── cliente.model.ts               # Cliente, Direccion, DTOs
│   │   ├── mantencion.model.ts            # Mantencion, TipoMantencion, DocMantencion, DTOs
│   │   ├── noticia.model.ts               # Noticia, SeccionNoticia, CreateNoticiaDto
│   │   ├── proyecto.model.ts              # Proyecto, EstadoProyecto, DocumentoRef, DTOs
│   │   ├── usuario.model.ts               # Usuario, RolUsuario, PermisoAcceso, DTOs
│   │   └── status.model.ts                # Status { type: 'ok'|'error', text: string }
│   ├── components/
│   │   ├── status-banner/                 # <app-status-banner [status]="...">
│   │   ├── crud-toolbar/                  # Tabs Crear/Editar/Eliminar/Buscar
│   │   ├── stat-chip/                     # <app-stat-chip [label] [variant]="ok|warning|danger|neutral">
│   │   └── spider-chart/                  # <app-spider-chart [labels] [values] [size]="260">
│   ├── utils.ts                           # asId(), encodeQuery(), toDateKey()
│   └── calendar-state.ts                  # createCalendarState() — compartido por ambos calendarios
│
├── layout/
│   ├── topbar/                            # Toggle modo, selector empresa (consumidor), campana notificaciones
│   ├── sidebar/                           # Nav con RouterLink, sub-ítems contextuales, logo dinámico
│   └── main-layout/                       # Shell: topbar + sidebar + <router-outlet>
│
├── profile/
│   ├── profile.service.ts                 # Signal + localStorage, modos admin/consumidor
│   ├── profile.types.ts                   # type ProfileMode = 'admin' | 'consumidor'
│   └── consumidor-context.service.ts      # empresaSeleccionada, centroSeleccionado, proyectoSeleccionado (signals)
│
├── features/
│   ├── auth/                              # Login admin, login consumidor, cambiar password + guards
│   ├── clientes/                          # CRUD empresas (admin)
│   ├── centros/                           # CRUD centros (admin) + mis-centros (consumidor con docs y solicitudes)
│   ├── proyectos/                         # CRUD proyectos (admin) + mis-proyectos + mi-proyecto-detalle (consumidor)
│   ├── usuarios/                          # CRUD usuarios (admin)
│   ├── activos/                           # CRUD activos por centro (admin) — ruta: /activos
│   ├── mantenciones/                      # CRUD con calendario mes/semana (admin) + mis-mantenciones (consumidor)
│   ├── documentos/                        # Shell detecta modo → admin (tabs) o consumidor (query params)
│   ├── solicitudes/                       # Solo service (sin página propia, usado por documentos/centros)
│   ├── noticias/                          # Shell → noticias-admin o noticias-consumidor según modo
│   ├── ayuda/                             # Placeholder (contenido hardcoded)
│   └── dashboard/
│       └── pages/
│           ├── inicio-page.*              # Dashboard consumidor (score, mantenciones, solicitudes, noticias)
│           ├── mi-ficha-page.*            # Ficha empresa consumidor
│           └── resumen-page.*             # Vista agregada admin
│
├── app.routes.ts                          # Lazy routes con guards (authGuard, soloAdminGuard, soloConsumidorGuard)
├── app.config.ts                          # provideRouter(withComponentInputBinding), provideHttpClient(withFetch, authInterceptor)
└── app.ts                                 # Solo <router-outlet>
```

## Rutas

| URL | Componente | Guard |
|-----|------------|-------|
| `/login-admin` | LoginAdminPageComponent | — |
| `/login-consumidor` | LoginConsumidorPageComponent | — |
| `/cambiar-password` | CambiarPasswordPageComponent | authGuard |
| `/` | homeGuard | redirige a /inicio o /empresa según rol |
| `/empresa` | ClientesPageComponent | soloAdminGuard |
| `/centros` | CentrosPageComponent | soloAdminGuard |
| `/proyectos` | ProyectosPageComponent | soloAdminGuard |
| `/usuarios` | UsuariosPageComponent | soloAdminGuard |
| `/activos` | ActivosPageComponent | soloAdminGuard |
| `/mantenciones` | MantencionesPageComponent | soloAdminGuard |
| `/resumen` | ResumenPageComponent | soloAdminGuard |
| `/inicio` | InicioPageComponent | soloConsumidorGuard |
| `/mi-ficha` | MiFichaPageComponent | soloConsumidorGuard |
| `/mis-centros` | MisCentrosPageComponent | soloConsumidorGuard |
| `/mis-proyectos` | MisProyectosPageComponent | soloConsumidorGuard |
| `/mis-proyectos/:id` | MiProyectoDetallePageComponent | soloConsumidorGuard |
| `/mis-mantenciones` | MisMantencionesPageComponent | soloConsumidorGuard |
| `/documentos` | DocumentosPageComponent (shell) | authGuard |
| `/noticias` | NoticiasPageComponent (shell) | authGuard |
| `/ayuda` | AyudaPageComponent | authGuard |

## Autenticación

`auth.service.ts` guarda `auth_token` y `auth_user` en `localStorage`.

Guards disponibles:
- `authGuard` — redirige a login si no autenticado
- `homeGuard` — redirige a `/empresa` (admin) o `/inicio` (consumidor)
- `soloAdminGuard` — bloquea consumidores
- `soloConsumidorGuard` — bloquea admins

`auth.interceptor.ts` agrega `Authorization: Bearer {token}` a todos los requests y maneja 401 con logout automático + flag `loggingOut` para evitar bucles.

## ConsumidorContextService

Mantiene contexto global del consumidor mediante signals:

```typescript
empresaSeleccionada  = signal<Cliente | null>(null);
centroSeleccionado   = signal<CentroCosto | null>(null);
proyectoSeleccionado = signal<Proyecto | null>(null);

seleccionar(cliente)     // limpia centro y proyecto
seleccionarCentro(c)
seleccionarProyecto(p)
```

Los componentes consumidor reaccionan a `empresaSeleccionada()` para filtrar o recargar datos.

## Patrón de feature service (estándar)

```typescript
@Injectable({ providedIn: 'root' })
export class XxxService {
  readonly items   = signal<Xxx[]>([]);       // nombre específico (clientes, centros, etc.)
  readonly status  = signal<Status | null>(null);
  readonly loading = signal(false);

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }

  cargar(): void { /* GET → signal.set(data) */ }
  crear(dto): void { /* POST → push a signal + status ok */ }
  actualizar(id, dto): void { /* PUT → map signal + status ok */ }
  eliminar(id): void { /* DELETE → filter signal + status ok */ }
  clearStatus(): void { this.status.set(null); }
}
```

**Excepciones al patrón:**
- `MantencionesService` y `TiposMantencionService`: sin signal `seleccionado` (edición vía `editingId` en componente)
- `DocumentosService`: signals separados por contexto (`documentosEmpresa`, `documentosCentro`, `documentosProyecto`)
- `SolicitudesService`: usa `SolicitudStatus` (tipo propio) en lugar de `Status` genérico

## Patrón de feature (estructura de archivos)

```
features/<nombre>/
├── <nombre>.service.ts
└── pages/
    └── <nombre>-page.component.{ts,html,css}
```

Con componentes dumb cuando hay formularios y listas complejos:
```
└── components/
    ├── <nombre>-form/    ← @Input initial, @Output submitted
    └── <nombre>s-list/   ← @Input items, @Output editado/eliminado
```

## Patrón modal con cierre automático

```typescript
constructor() {
  effect(() => {
    if (this.service.status()?.type === 'ok' && this.showModal()) {
      this.cerrarModal();
    }
  });
}
// abrirCrear() y abrirEditar() deben llamar service.clearStatus() al abrir
// <app-status-banner> dentro del modal para mostrar errores sin cerrarlo
```

## Backend — respuestas paginadas vs array plano

```typescript
// ClientesService, CentrosService, ProyectosService, UsuariosService
next: res => this.items.set(Array.isArray(res) ? res : res.data)

// SolicitudesService, MantencionesService, TiposMantencionService, ActivosService
next: res => this.items.set(res)  // siempre array plano
```

## Activos

Feature CRUD para activos por centro (solo modo admin):
- Ruta: `/activos`
- `activos.service.ts` depende de `CentrosService` para obtener `empresaId`
- Modelo: `Activo { nombre, tipo_activo, centro_costo_id, descripcion?, activo }`

## Solicitudes — campo empresa_id

El campo FK de cliente en solicitudes se llama **`empresa_id`** (no `cliente_id`). Es intencional y consistente con el backend. `SolicitudesService` hace las peticiones a `/empresas/:empresaId/solicitudes`.

## Calendario — mantenciones

Lógica compartida extraída a `src/app/shared/calendar-state.ts` como función `createCalendarState()`. Ambos componentes delegan en `_cal = createCalendarState()`.

```typescript
toDateKey(d: Date): string  // exportada desde shared/utils.ts → YYYY-MM-DD
// mantencionesEnDia(date) → usa SIEMPRE mantencionesFiltradas(), nunca service.mantenciones()
// filtroEmpresaId (admin) → signal → centroIdsPorEmpresa computed → mantencionesFiltradas computed
// Consumidor → filtra automáticamente por ctx.empresaSeleccionada()
```

`mis-mantenciones-page.component.ts` reutiliza `styleUrl: './mantenciones-page.component.css'`.

## Topbar — notificaciones (consumidor)

Dropdown campana en `TopbarComponent`:
- Mantenciones próximas en 7 días + solicitudes vencidas/rechazadas
- Filtra por empresa seleccionada via `centroIdsPorEmpresa` computed
- CSS: `position: absolute; top: calc(100% + 8px); right: 0` (z-index 1002)
- Backdrop `position: fixed; z-index: 1001` para cerrar al hacer clic fuera

## Navegación con query params — Documentos

```typescript
router.navigate(['/documentos'], {
  queryParams: { tab: 'documentacion' | 'solicitudes', centroId, proyectoId }
});
// DocumentosConsumidorPageComponent lee params en ngOnInit
```

## Score documental

Patrón reutilizado en inicio, mi-ficha, mis-centros y detalle de proyecto:
- Porcentaje: `aprobados / total * 100`
- Barra de progreso con degradado azul→verde
- 5 estados: Aprobados (verde) · Revisión (amarillo) · Vencidos (rojo) · Rechazados (rosa) · Pendiente (azul claro)
- `<app-stat-chip>` con variante `ok/warning/danger` según porcentaje

## Dependencias entre features

```
Centros       → ClientesService
Proyectos     → ClientesService + CentrosService
Usuarios      → ClientesService + CentrosService
Activos       → CentrosService + ClientesService
Documentos    → ClientesService + CentrosService + ProyectosService + SolicitudesService
Mantenciones  → TiposMantencionService + CentrosService + ClientesService
Topbar        → ClientesService + CentrosService + MantencionesService + TiposMantencionService + SolicitudesService
Resumen       → todos los services (solo lectura)
MisCentros/MisProyectos/MiFicha → SolicitudesService + DocumentosService
```

## Convenciones de código

- **Todos los componentes son standalone** — no hay NgModule
- **Angular 18+ control flow** (`@for`, `@if`, `@let`) — nunca `*ngFor`/`*ngIf`. No mezclar
- **Signals** para todo el estado reactivo — no usar `BehaviorSubject` ni `Subject`
- **`asId()`** obligatorio al comparar ObjectIds entre entidades
- **`toDateKey()`** de `shared/utils.ts` para convertir `Date` a `YYYY-MM-DD`
- **Sin `any`** — si la API devuelve algo no tipado, extender la interfaz
- Estilos globales en `src/styles.css`: `.card`, `.form-grid`, `.field`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-sm`, `.list`, `.empty`
- Nombre correcto del tipo: `PermisoAcceso` (no `PermisoItem`)

## Problemas conocidos

| Severidad | Problema |
|-----------|----------|
| ⚠️ MEDIO | `documentos-consumidor-page`: `effect()` sin cleanup `DestroyRef` (memory leak) |
| ⚠️ MEDIO | `solicitudes.service`: type casting `(s as any).adjunto` — refactor pendiente |
| ⚠️ MEDIO | JWT en `localStorage` — vulnerable a XSS |
| ⚠️ BAJO | Modo admin/consumidor en `localStorage` — manipulable desde DevTools |
| 🔵 INFO | `dashboard/components/` tiene 4 carpetas vacías (placeholders) |
| 🔵 INFO | `shared/components/entity-card/` directorio vacío sin uso |
| 🔵 INFO | `ayuda-page` con contenido hardcoded |

## Guía para el agente IA

1. **Agregar entidad nueva:** crear carpeta en `features/`, seguir patrón de `clientes/`. Ruta en `app.routes.ts` con guard correspondiente. Ítem en `sidebar.component.ts`.

2. **Agregar campo:** actualizar modelo en `shared/models/`, DTO, método `empty()` del form, HTML, y `actualizar()` de la page si filtra campos.

3. **Componente compartido:** en `shared/components/` solo si lo usan 2+ features. Si es de una sola feature, va en `features/<nombre>/components/`.

4. **NO usar `any`** — extender la interfaz si la respuesta no encaja.

5. **NO inyectar services en componentes dumb** — toda la lógica HTTP va en el service.

6. **Documentos:** backend espera multipart/form-data con campo `archivo`. Usar `DocumentosService.subir()` siempre.

7. **Mantenciones:** el filtro de empresa es client-side (computed). No recargar el service al cambiar empresa — el computed reacciona automáticamente.

8. **Effects con cleanup:** siempre inyectar `DestroyRef` y pasarlo a `effect()` para evitar memory leaks.
