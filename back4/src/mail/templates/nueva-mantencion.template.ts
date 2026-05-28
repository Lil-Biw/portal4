export function nuevaMantencionHtml(params: {
  nombre: string;
  tipo: string;
  fecha: string;
  descripcion?: string;
  centro: string;
  portalUrl: string;
  destinatario: string;
}): string {
  const descripcionBloque = params.descripcion
    ? `<p style="margin:0 0 8px;font-size:14px;color:#6b7280">Descripción</p>
       <p style="margin:0;color:#374151">${params.descripcion}</p>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
      <img src="https://smartclarity.cl/SM_logo_2líneas.png" alt="SmartClarity" style="height:40px;margin-bottom:24px" />
      <h2 style="color:#1f2937;margin:0 0 8px">Hola, ${params.destinatario}</h2>
      <p style="color:#374151;margin:0 0 24px">
        Se ha programado una nueva mantención en el centro <strong>${params.centro}</strong>:
      </p>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Nombre</p>
        <p style="margin:0 0 16px;font-weight:700;color:#111827">${params.nombre}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Tipo</p>
        <p style="margin:0 0 16px;font-weight:700;color:#111827">${params.tipo}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Fecha</p>
        <p style="margin:0 0 16px;font-weight:700;color:#111827">${params.fecha}</p>
        ${descripcionBloque}
      </div>
      <a href="${params.portalUrl}/mis-mantenciones"
         style="display:inline-block;background:#0095d6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
        Ver mantenciones
      </a>
    </div>
  `;
}
