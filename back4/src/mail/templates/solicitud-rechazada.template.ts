export function solicitudRechazadaHtml(params: {
  destinatario: string;
  nombre: string;
  tipo: string;
  motivo_rechazo: string;
  centro: string;
  portalUrl: string;
}): string {
  const motivoBloque = params.motivo_rechazo
    ? `<div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:16px;margin-bottom:24px">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#9f1239;text-transform:uppercase">Motivo del rechazo</p>
        <p style="margin:0;color:#374151;font-size:15px;line-height:1.5">${params.motivo_rechazo}</p>
      </div>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
      <img src="https://smartclarity.cl/SM_logo_2líneas.png" alt="SmartClarity" style="height:40px;margin-bottom:24px" />
      <h2 style="color:#1f2937;margin:0 0 8px">Hola, ${params.destinatario}</h2>
      <p style="color:#374151;margin:0 0 24px">
        La siguiente solicitud de documentos en <strong>${params.centro}</strong> ha sido <strong style="color:#dc2626">rechazada</strong>:
      </p>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:16px">
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Documento solicitado</p>
        <p style="margin:0 0 16px;font-weight:700;color:#111827">${params.nombre}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Tipo</p>
        <p style="margin:0;font-weight:700;color:#111827">${params.tipo}</p>
      </div>
      ${motivoBloque}
      <p style="color:#374151;margin:0 0 24px;font-size:14px">
        Puedes ingresar al portal para reenviar el documento corregido.
      </p>
      <a href="${params.portalUrl}/documentos?tab=solicitudes"
         style="display:inline-block;background:#0095d6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
        Ver solicitudes
      </a>
    </div>
  `;
}
