import { e } from './html-escape';
import { SC_LOGO_HTML } from './logo';

export function nuevaActividadHtml(params: {
  nombre: string;
  tipo: string;
  fecha: string;
  descripcion?: string;
  centro: string;
  activos: string[];
  portalUrl: string;
  destinatario: string;
}): string {
  const descripcionBloque = params.descripcion
    ? `<div style="padding:12px 16px;border-bottom:1px solid #e5e7eb">
         <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin:0 0 3px">Descripción</p>
         <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.5">${e(params.descripcion)}</p>
       </div>`
    : '';

  const activosBloque = params.activos.length > 0
    ? `<div style="padding:12px 16px;border-bottom:1px solid #e5e7eb">
         <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin:0 0 8px">Activos incluidos</p>
         <div>
           ${params.activos.map(a => `
             <span style="display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:4px 10px;font-size:12px;color:#111827;margin-right:6px;margin-bottom:6px">
               ${e(a)}
             </span>`).join('')}
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
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.4px;text-transform:uppercase;background:#E1F5EE;color:#085041">Nueva actividad</span>
          </td>
        </tr>
      </table>

      <div style="padding:20px 24px">
        <div style="display:flex;align-items:flex-start">
          <div style="width:42px;height:42px;border-radius:50%;background:#E1F5EE;flex-shrink:0;font-size:22px;line-height:42px;text-align:center;margin-right:14px">📅</div>
          <div>
            <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 6px">Hola, ${e(params.destinatario)}</p>
            <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.4">Nueva actividad programada en <strong style="color:#111827">${e(params.centro)}</strong>.</p>
          </div>
        </div>
      </div>

      <div style="border-top:1px solid #e5e7eb"></div>

      <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb">
        <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin:0 0 3px">Nombre</p>
        <p style="font-size:14px;font-weight:500;color:#111827;margin:0">${e(params.nombre)}</p>
      </div>

      <div style="display:flex;border-bottom:1px solid #e5e7eb">
        <div style="flex:1;padding:12px 16px;border-right:1px solid #e5e7eb">
          <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin:0 0 3px">Tipo</p>
          <p style="font-size:13px;font-weight:500;color:#111827;margin:0">${e(params.tipo)}</p>
        </div>
        <div style="flex:1;padding:12px 16px">
          <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin:0 0 3px">Fecha</p>
          <p style="font-size:13px;font-weight:500;color:#111827;margin:0">${e(params.fecha)}</p>
        </div>
      </div>

      ${descripcionBloque}
      ${activosBloque}

      <div style="padding:18px 24px">
        <a href="${params.portalUrl}/mis-actividades"
           style="display:inline-flex;align-items:center;gap:6px;background:#0F6E56;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700">
          Ver actividades →
        </a>
      </div>

    </div>
  `;
}
