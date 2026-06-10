# Diseño: Toggle "Notificar Super Admins" en notificaciones por correo

**Fecha:** 2026-06-10  
**Estado:** Aprobado

## Problema

Actualmente el backend siempre incluye a todos los usuarios con rol `super_admin` como destinatarios de las notificaciones por correo al crear actividades o solicitudes, sin importar las opciones seleccionadas en la UI. No hay forma de excluirlos.

El objetivo es que quien crea la actividad o solicitud decida explícitamente si la notificación amerita molestar a los super_admins.

## Decisiones de diseño

- **Control por evento**, no por preferencia de usuario: el checkbox aparece en el formulario de creación/rechazo, no en el perfil del super_admin.
- **Default desmarcado**: los super_admins no reciben notificaciones a menos que se marque explícitamente.
- **Todos o ninguno**: un solo checkbox para todos los super_admins activos (no selección individual).
- **Cambio aditivo**: se agrega `notificar_super_admins?: boolean` al DTO existente. Default `false` por omisión, sin romper flujos existentes.

## Cambios backend

### `src/common/dto/notificacion-opciones.dto.ts`
Agregar campo:
```ts
@IsBoolean()
@IsOptional()
notificar_super_admins?: boolean;
```

### `src/actividades/actividades.service.ts`
En `notificarUsuariosCentro`: condicionar la query de super_admins al flag `opciones.notificar_super_admins === true`. Si no está activo, no se consultan ni agregan.

### `src/solicitudes/solicitudes.service.ts`
Mismo patrón en `notificarNuevaSolicitud` y `notificarRechazoSolicitud`.

## Cambios frontend

### `src/app/shared/models/actividad.model.ts`
Agregar a `NotificacionOpciones`:
```ts
notificar_super_admins?: boolean;
```

### `src/app/features/actividades/pages/actividades-page.component`
- Signal: `notifSuperAdmins = signal(false)`
- Reset a `false` al abrir modal (`abrirCrear`, `abrirEditar`)
- Incluir en el DTO al guardar: `notificacion.notificar_super_admins = this.notifSuperAdmins()`
- HTML: checkbox "Notificar Super Admins" debajo de los tabs, visible solo cuando `notifNotificar() === true`

### `src/app/features/documentos/pages/documentos-admin-page.component`
Dos contextos independientes:
- **Crear solicitud**: signal `notifSolicitudSuperAdmins = signal(false)`, reset en `abrirModalSolicitud`, incluir al crear
- **Rechazar solicitud**: signal `notifRechazoSuperAdmins = signal(false)`, reset al abrir modal de rechazo, incluir al cambiar estado

## UI — posición del checkbox

El checkbox aparece debajo de los tabs Usuarios/Admins, separado por una línea divisoria, solo cuando `notificar === true`:

```
☑ Notificar por correo
  [Usuarios (3/3)] [Admins (2/2)]
  ─────────────────────────────────
  ☐ Notificar Super Admins
```

## Archivos afectados

| Archivo | Tipo de cambio |
|---|---|
| `back4/src/common/dto/notificacion-opciones.dto.ts` | +1 campo opcional |
| `back4/src/actividades/actividades.service.ts` | condicional en query super_admins |
| `back4/src/solicitudes/solicitudes.service.ts` | condicional en 2 métodos |
| `front4/src/app/shared/models/actividad.model.ts` | +1 campo interfaz |
| `front4/src/app/features/actividades/pages/actividades-page.component.ts` | +signal, +reset, +DTO |
| `front4/src/app/features/actividades/pages/actividades-page.component.html` | +checkbox UI |
| `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts` | +2 signals, +resets, +DTOs |
| `front4/src/app/features/documentos/pages/documentos-admin-page.component.html` | +2 checkboxes UI |
