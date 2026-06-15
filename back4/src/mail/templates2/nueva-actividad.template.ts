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
    ? `<p style="margin:0 0 8px;font-size:14px;color:#6b7280">Descripción</p>
       <p style="margin:0 0 16px;color:#374151">${e(params.descripcion)}</p>`
    : '';

  const activosBloque = params.activos.length > 0
    ? `<p style="margin:0 0 8px;font-size:14px;color:#6b7280">Activos incluidos</p>
       <ul style="margin:0 0 16px;padding-left:20px;color:#374151">
         ${params.activos.map(a => `<li style="margin-bottom:4px">${e(a)}</li>`).join('')}
       </ul>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
      <img src="https://smartclarity.cl/SM_logo_2líneas.png" alt="SmartClarity" style="height:40px;margin-bottom:24px" />
      <h2 style="color:#1f2937;margin:0 0 8px">Hola, ${e(params.destinatario)}</h2>
      <p style="color:#374151;margin:0 0 24px">
        Se ha programado una nueva actividad en el centro <strong>${e(params.centro)}</strong>:
      </p>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Nombre</p>
        <p style="margin:0 0 16px;font-weight:700;color:#111827">${e(params.nombre)}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Tipo</p>
        <p style="margin:0 0 16px;font-weight:700;color:#111827">${e(params.tipo)}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Fecha</p>
        <p style="margin:0 0 16px;font-weight:700;color:#111827">${e(params.fecha)}</p>
        ${activosBloque}
        ${descripcionBloque}
      </div>
      <a href="${params.portalUrl}/mis-actividades"
         style="display:inline-block;background:#0095d6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
        Ver actividades
      </a>
    </div>
  `;
}
