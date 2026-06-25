# Notificar admins al subir documento (consumidor)

**Fecha:** 2026-06-25
**Estado:** Aprobado

## Objetivo

Cuando un consumidor (rol `usuario`) sube un documento en el tab Documentación, se debe:
1. Mostrarle una advertencia visible antes de confirmar la subida.
2. Notificar por email a todos los admins (`admin_smartclarity` + `super_admin`) activos del portal.

## Alcance

- Solo aplica a subidas hechas por consumidores (rol `usuario`).
- Cubre los endpoints de centros y proyectos (los únicos que aceptan rol `usuario`).
- El endpoint de empresa (`POST /empresas/:id/documentos`) ya está restringido a admins — no requiere notificación.
- La advertencia en frontend aplica únicamente en `documentos-consumidor-page.component`.

## Frontend

### Advertencia en panel de subida

En `documentos-consumidor-page.component.html`, dentro del bloque `@if (panels[docTipo].showUpload)`, encima de la zona de drop, se agrega un banner estático de advertencia:

- Fondo: `#fef9c3` (amarillo suave)
- Borde: `1px solid #fde68a`
- Texto: `#92400e`
- Ícono de advertencia (⚠ SVG o carácter)
- Texto: *"Al confirmar la subida, los administradores del portal serán notificados por correo electrónico."*

No requiere cambios en el TypeScript del componente.

## Backend

### Nuevo template de email

Archivo: `back4/src/mail/templates/nuevo-documento.template.ts`

Parámetros:
- `destinatario`: nombre del admin destinatario
- `nombre`: nombre del documento
- `categoria`: categoría del documento
- `contexto`: descripción del origen (ej. "Centro: Planta Norte", "Proyecto: OT-2025")
- `empresa`: nombre de la empresa
- `portalUrl`: URL del portal

Estilo consistente con los templates existentes (logo SmartClarity, colores, estructura HTML).

### Nuevo método en MailService

`notificarNuevoDocumento(params)` siguiendo el patrón `enviarATodos` existente.

### Notificación en CentrosCostosController

En `subirDocumento` de `centros-costos.controller.ts`, luego de guardar el documento:
- Buscar todos los usuarios activos con rol `admin_smartclarity` o `super_admin`
- Llamar `mailService.notificarNuevoDocumento(...)` con nombre, categoría y contexto del centro
- Fire-and-forget (no bloquea la respuesta)

El controlador necesita acceso a `MailService` y al modelo `Usuario` (inyección en el módulo).

### Notificación en ProyectosController

Mismo patrón que centros, con contexto del proyecto.

## Destinatarios

Todos los usuarios activos con rol `admin_smartclarity` O `super_admin`, sin filtro de empresa.

## Comportamiento ante fallos

Si el envío de email falla, se loguea el error (`Logger.error`) y la respuesta al cliente no se ve afectada. La subida ya fue persistida.
