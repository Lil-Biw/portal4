# Notificar admins al subir documento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notificar por email a todos los admins cuando un consumidor sube un documento, y mostrar advertencia en el frontend.

**Architecture:** Template de email nuevo + método en MailService + llamada fire-and-forget en los servicios de centros y proyectos + banner de aviso en el componente consumidor.

**Tech Stack:** NestJS, Nodemailer, Angular 21 standalone + signals

---

## Task 1: Template email nuevo-documento

**Files:**
- Create: `back4/src/mail/templates/nuevo-documento.template.ts`
- Modify: `back4/src/mail/mail.service.ts`

- [ ] **Step 1: Crear template**

```typescript
// back4/src/mail/templates/nuevo-documento.template.ts
import { e } from './html-escape';
import { SC_LOGO_HTML } from './logo';

export function nuevoDocumentoHtml(params: {
  destinatario: string;
  nombre: string;
  categoria: string;
  contexto: string;
  portalUrl: string;
}): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">

      <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e5e7eb">
        <tr>
          <td style="padding:18px 24px;vertical-align:middle">
            ${SC_LOGO_HTML}
          </td>
          <td style="padding:18px 24px;vertical-align:middle;text-align:right;white-space:nowrap">
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.4px;text-transform:uppercase;background:#E6F1FB;color:#185FA5">Nuevo documento</span>
          </td>
        </tr>
      </table>

      <div style="padding:20px 24px">
        <div style="display:flex;align-items:flex-start">
          <div style="width:42px;height:42px;border-radius:50%;background:#E6F1FB;flex-shrink:0;font-size:22px;line-height:42px;text-align:center;margin-right:14px">📎</div>
          <div>
            <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 6px">Hola, ${e(params.destinatario)}</p>
            <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.4">Se ha subido un nuevo documento en <strong style="color:#111827">${e(params.contexto)}</strong>.</p>
          </div>
        </div>
      </div>

      <div style="border-top:1px solid #e5e7eb"></div>

      <div style="display:flex">
        <div style="flex:1;padding:12px 16px;border-bottom:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
          <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin:0 0 3px">Documento</p>
          <p style="font-size:14px;font-weight:500;color:#111827;margin:0;line-height:1.4">${e(params.nombre)}</p>
        </div>
        <div style="flex:1;padding:12px 16px;border-bottom:1px solid #e5e7eb">
          <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin:0 0 3px">Categoría</p>
          <p style="font-size:14px;font-weight:500;color:#111827;margin:0">${e(params.categoria)}</p>
        </div>
      </div>

      <div style="padding:18px 24px">
        <a href="${e(params.portalUrl)}/documentos"
           style="display:inline-flex;align-items:center;gap:6px;background:#0095d6;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700">
          Ver documentación →
        </a>
      </div>

    </div>
  `;
}
```

- [ ] **Step 2: Agregar método notificarNuevoDocumento en MailService**

En `back4/src/mail/mail.service.ts`, agregar import del nuevo template y el método:

```typescript
import { nuevoDocumentoHtml } from './templates/nuevo-documento.template';
```

Y agregar el método al final de la clase:

```typescript
async notificarNuevoDocumento(params: {
  destinatarios: { nombre: string; email: string }[];
  documento: { nombre: string; categoria: string; contexto: string };
}): Promise<void> {
  const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
  await this.enviarATodos(
    params.destinatarios,
    `Nuevo documento subido — ${params.documento.contexto}`,
    dest => nuevoDocumentoHtml({
      destinatario: dest.nombre,
      nombre:       params.documento.nombre,
      categoria:    params.documento.categoria,
      contexto:     params.documento.contexto,
      portalUrl,
    }),
    'nuevo-documento',
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add back4/src/mail/templates/nuevo-documento.template.ts back4/src/mail/mail.service.ts
git commit -m "feat(mail): template y método notificarNuevoDocumento"
```

---

## Task 2: Notificación en CentrosCostosService

**Files:**
- Modify: `back4/src/centros-costos/centros-costos.service.ts`

- [ ] **Step 1: Hacer agregarDocumento async y agregar notificación fire-and-forget**

Reemplazar el método `agregarDocumento` existente:

```typescript
async agregarDocumento(id: string, archivo: ArchivoInput, nombreDisplay?: string, categoria?: string, usuarioId?: string) {
  const result = await this.docsHelper.agregar(id, archivo, nombreDisplay, categoria, usuarioId);
  this.notificarSubidaDocumento(id, result.nombre_display, result.categoria).catch(() => {});
  return result;
}

private async notificarSubidaDocumento(centroId: string, nombre: string, categoria?: string): Promise<void> {
  const centro = await this.centroCostoModel.findById(centroId).select('nombre').lean() as any;
  const contexto = centro ? `Centro: ${centro.nombre}` : 'Centro de costos';
  const admins = await this.usuarioModel
    .find({ rol: { $in: ['admin_smartclarity', 'super_admin'] }, activo: true })
    .select('nombre email')
    .lean();
  if (!admins.length) return;
  await this.mailService.notificarNuevoDocumento({
    destinatarios: admins.map(a => ({ nombre: a.nombre, email: a.email })),
    documento: { nombre, categoria: categoria ?? 'Sin categoría', contexto },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add back4/src/centros-costos/centros-costos.service.ts
git commit -m "feat(centros): notificar admins al subir documento"
```

---

## Task 3: Notificación en ProyectosService

**Files:**
- Modify: `back4/src/proyectos/proyectos.service.ts`

- [ ] **Step 1: Hacer agregarDocumento async y agregar notificación fire-and-forget**

Reemplazar el método `agregarDocumento` existente:

```typescript
async agregarDocumento(id: string, archivo: ArchivoInput, nombreDisplay?: string, categoria?: string, usuarioId?: string) {
  const result = await this.docsHelper.agregar(id, archivo, nombreDisplay, categoria, usuarioId);
  this.notificarSubidaDocumento(id, result.nombre_display, result.categoria).catch(() => {});
  return result;
}

private async notificarSubidaDocumento(proyectoId: string, nombre: string, categoria?: string): Promise<void> {
  const proyecto = await this.proyectoModel.findById(proyectoId).select('nombre').lean() as any;
  const contexto = proyecto ? `Proyecto: ${proyecto.nombre}` : 'Proyecto';
  const admins = await this.usuarioModel
    .find({ rol: { $in: ['admin_smartclarity', 'super_admin'] }, activo: true })
    .select('nombre email')
    .lean();
  if (!admins.length) return;
  await this.mailService.notificarNuevoDocumento({
    destinatarios: admins.map(a => ({ nombre: a.nombre, email: a.email })),
    documento: { nombre, categoria: categoria ?? 'Sin categoría', contexto },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add back4/src/proyectos/proyectos.service.ts
git commit -m "feat(proyectos): notificar admins al subir documento"
```

---

## Task 4: Banner de advertencia en frontend

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html`

- [ ] **Step 1: Agregar banner dentro del panel de subida**

En el bloque `@if (panels[docTipo].showUpload)`, antes de la zona de drop, agregar:

```html
<!-- Aviso notificación a admins -->
<div style="display:flex;align-items:flex-start;gap:.6rem;padding:.75rem 1rem;margin-bottom:1rem;background:#fef9c3;border:1px solid #fde68a;border-radius:8px">
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  <p style="margin:0;font-size:.8rem;color:#92400e;line-height:1.4"><strong>Aviso:</strong> Al confirmar la subida, los administradores del portal serán notificados por correo electrónico.</p>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html
git commit -m "feat(front): aviso a consumidor que admins serán notificados al subir documento"
```
