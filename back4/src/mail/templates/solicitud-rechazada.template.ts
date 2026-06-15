export function solicitudRechazadaHtml(params: {
  destinatario: string;
  nombre: string;
  tipo: string;
  motivo_rechazo: string;
  centro: string;
  portalUrl: string;
}): string {
  const motivoBloque = params.motivo_rechazo
    ? `<div style="padding:14px 16px;border-bottom:1px solid #fca5a5;background:#fef2f2;display:flex;gap:10px;align-items:flex-start">
         <span style="font-size:18px;color:#991b1b;flex-shrink:0;margin-top:1px">⚠</span>
         <div>
           <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px;color:#991b1b">Motivo del rechazo</p>
           <p style="font-size:13px;color:#1f2937;margin:0;line-height:1.5">${params.motivo_rechazo}</p>
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
        <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.4px;text-transform:uppercase;background:#fee2e2;color:#991b1b">Rechazada</span>
      </div>

      <div style="padding:20px 24px">
        <div style="display:flex;align-items:flex-start;gap:14px">
          <div style="width:42px;height:42px;border-radius:50%;background:#fee2e2;color:#991b1b;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;font-weight:700">✕</div>
          <div>
            <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 2px">Hola, ${params.destinatario}</p>
            <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.4">Tu solicitud en <strong style="color:#111827">${params.centro}</strong> fue rechazada.</p>
          </div>
        </div>
      </div>

      <div style="border-top:1px solid #e5e7eb"></div>

      <div style="display:grid;grid-template-columns:1fr 1fr">
        <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
          <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin:0 0 3px">Documento solicitado</p>
          <p style="font-size:14px;font-weight:500;color:#111827;margin:0;line-height:1.4">${params.nombre}</p>
        </div>
        <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb">
          <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin:0 0 3px">Tipo</p>
          <p style="font-size:14px;font-weight:500;color:#111827;margin:0">${params.tipo}</p>
        </div>
      </div>

      ${motivoBloque}

      <div style="padding:18px 24px;display:flex;align-items:center;justify-content:space-between">
        <a href="${params.portalUrl}/documentos?tab=solicitudes"
           style="display:inline-flex;align-items:center;gap:6px;background:#991b1b;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700">
          Reenviar documento ↑
        </a>
        <p style="font-size:12px;color:#6b7280;margin:0;max-width:180px;line-height:1.4">Sube la versión corregida desde el portal.</p>
      </div>

    </div>
  `;
}
