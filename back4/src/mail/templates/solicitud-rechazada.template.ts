import { e } from './html-escape';
import { SC_LOGO_HTML } from './logo';
import { ContextoJerarquico, tituloJerarquia, breadcrumbJerarquiaHtml } from './jerarquia';

export function solicitudRechazadaHtml(params: {
  destinatario: string;
  nombre: string;
  tipo: string;
  motivo_rechazo?: string;
  jerarquia: ContextoJerarquico;
  portalUrl: string;
}): string {
  const motivoBloque = params.motivo_rechazo
    ? `<div style="padding:14px 16px;border-bottom:1px solid #fca5a5;background:#fef2f2;display:flex;align-items:flex-start">
         <span style="font-size:18px;color:#991b1b;flex-shrink:0;margin-top:1px;margin-right:10px">⚠</span>
         <div>
           <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px;color:#991b1b">Motivo del rechazo</p>
           <p style="font-size:13px;color:#1f2937;margin:0;line-height:1.5">${e(params.motivo_rechazo)}</p>
         </div>
       </div>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">

      <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e5e7eb">
        <tr>
          <td style="padding:18px 24px;vertical-align:middle">
            ${SC_LOGO_HTML}
          </td>
          <td style="padding:18px 24px;vertical-align:middle;text-align:right;white-space:nowrap">
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.4px;text-transform:uppercase;background:#fee2e2;color:#991b1b">Rechazada</span>
          </td>
        </tr>
      </table>

      <div style="padding:20px 24px">
        <div style="display:flex;align-items:flex-start">
          <div style="width:42px;height:42px;border-radius:50%;background:#fee2e2;color:#991b1b;flex-shrink:0;font-size:20px;font-weight:700;line-height:42px;text-align:center;margin-right:14px">✕</div>
          <div>
            <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 6px">Hola, ${e(params.destinatario)}</p>
            <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.4">Tu solicitud en <strong style="color:#111827">${e(tituloJerarquia(params.jerarquia))}</strong> fue rechazada.</p>
            ${breadcrumbJerarquiaHtml(params.jerarquia)}
          </div>
        </div>
      </div>

      <div style="border-top:1px solid #e5e7eb"></div>

      <div style="display:flex">
        <div style="flex:1;padding:12px 16px;border-bottom:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
          <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin:0 0 3px">Documento solicitado</p>
          <p style="font-size:14px;font-weight:500;color:#111827;margin:0;line-height:1.4">${e(params.nombre)}</p>
        </div>
        <div style="flex:1;padding:12px 16px;border-bottom:1px solid #e5e7eb">
          <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin:0 0 3px">Tipo</p>
          <p style="font-size:14px;font-weight:500;color:#111827;margin:0">${e(params.tipo)}</p>
        </div>
      </div>

      ${motivoBloque}

      <div style="padding:18px 24px">
        <a href="${e(params.portalUrl)}/documentos?tab=solicitudes"
           style="display:inline-flex;align-items:center;gap:6px;background:#991b1b;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700">
          Reenviar documento ↑
        </a>
        <p style="font-size:12px;color:#6b7280;margin:8px 0 0;line-height:1.4">Sube la versión corregida desde el portal.</p>
      </div>

    </div>
  `;
}
