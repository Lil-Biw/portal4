import { e } from './html-escape';

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
         <div style="display:flex;flex-wrap:wrap;gap:6px">
           ${params.activos.map(a => `
             <span style="display:inline-flex;align-items:center;gap:5px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:4px 10px;font-size:12px;color:#111827">
               ${e(a)}
             </span>`).join('')}
         </div>
       </div>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">

      <div style="padding:18px 24px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:9px;height:9px;background:#0095d6;border-radius:50%"></div>
          <span style="font-size:15px;font-weight:700;color:#0095d6">SmartClarity</span>
        </div>
        <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.4px;text-transform:uppercase;background:#E1F5EE;color:#085041">Nueva actividad</span>
      </div>

      <div style="padding:20px 24px">
        <div style="display:flex;align-items:flex-start;gap:14px">
          <div style="width:42px;height:42px;border-radius:50%;background:#E1F5EE;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px">📅</div>
          <div>
            <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 2px">Hola, ${e(params.destinatario)}</p>
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
