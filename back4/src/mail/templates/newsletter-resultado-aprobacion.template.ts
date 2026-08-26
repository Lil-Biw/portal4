import { e } from './html-escape';
import { SC_LOGO_CID } from './logo';

export function notificarResultadoAprobacionHtml(params: {
  destinatario: string;
  titulo: string;
  aprobado: boolean;
  motivo?: string;
  portalUrl: string;
  logoUrl: string;
}): string {
  const color = params.aprobado ? '#2EAE6E' : '#E5484D';
  const estadoTexto = params.aprobado ? 'aprobado' : 'rechazado';
  const emoji = params.aprobado ? '✅' : '❌';
  const motivoBlock = !params.aprobado && params.motivo
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin:18px 0"><p style="margin:0;font-size:14px;color:#991b1b;line-height:1.5"><strong>Motivo del rechazo:</strong><br>${e(params.motivo).replace(/\n/g, '<br>')}</p></div>`
    : '';

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f6f8fa;padding:24px 12px;color:#363d44">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.04)">
        <div style="background:${color};padding:32px 30px;text-align:center">
          <img src="cid:${SC_LOGO_CID}" alt="SmartClarity" style="height:36px;width:auto;margin-bottom:12px">
          <div style="font-weight:bold;font-size:20px;color:#ffffff;line-height:1.3">${emoji} Newsletter ${estadoTexto}</div>
        </div>
        <div style="padding:28px 30px">
          <p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#374151">Hola ${e(params.destinatario) || ''},</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#374151">
            Tu newsletter <strong>"${e(params.titulo)}"</strong> fue <strong style="color:${color}">${estadoTexto}</strong> por el super_admin aprobador.
          </p>
          ${motivoBlock}
          <div style="text-align:center;margin-top:24px">
            <a href="${e(params.portalUrl)}/noticias" target="_blank" style="display:inline-block;background:#0095d6;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px">Ver newsletters</a>
          </div>
        </div>
        <div style="padding:16px 30px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
          Comunicación interna del equipo · SmartClarity &amp; eCLARITI
        </div>
      </div>
    </div>
  `;
}
