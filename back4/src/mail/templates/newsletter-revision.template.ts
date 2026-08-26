import { e } from './html-escape';
import { SC_LOGO_CID } from './logo';
import { bloqueEmailHtml, BloqueRender } from './newsletter.template';

export function notificarNewsletterRevisionHtml(params: {
  titulo: string;
  tagline?: string;
  bloques: BloqueRender[];
  solicitanteNombre: string;
  solicitanteEmail: string;
  revisarUrl: string;
  logoUrl: string;
}): string {
  const tagline = params.tagline
    ? `<p style="margin:0;color:#6b7280;font-size:14px;line-height:1.5">${e(params.tagline)}</p>`
    : '';

  // El aprobador necesita ver el contenido completo (sin resumen ni link
  // "seguir leyendo") para poder juzgar el newsletter antes de aprobar/rechazar.
  const bloques = params.bloques
    .map((b, i) => `${i > 0 ? '<div style="border-top:1px solid #e5e7eb;margin:18px 0 0"></div>' : ''}${bloqueEmailHtml(b, i, '', { truncar: false })}`)
    .join('');

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f6f8fa;padding:24px 12px;color:#363d44">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.04)">
        <div style="background:#162640;padding:32px 30px;text-align:center">
          <img src="cid:${SC_LOGO_CID}" alt="SmartClarity" style="height:36px;width:auto;margin-bottom:12px">
          <div style="font-weight:bold;font-size:20px;color:#ffffff;line-height:1.3">⚡ Newsletter pendiente de aprobación</div>
        </div>
        <div style="padding:28px 30px">
          <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#374151">
            <strong>${e(params.solicitanteNombre || params.solicitanteEmail)}</strong> solicitó tu aprobación para enviar el siguiente newsletter al equipo.
          </p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:18px;margin:18px 0">
            <p style="font-weight:700;font-size:18px;color:#002c51;margin:0 0 6px">${e(params.titulo)}</p>
            ${tagline}
          </div>
          ${bloques}
          <div style="text-align:center;margin-top:28px">
            <a href="${e(params.revisarUrl)}" target="_blank" style="display:inline-block;background:#0095d6;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px">Revisar en el portal</a>
          </div>
        </div>
        <div style="padding:16px 30px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
          Comunicación interna del equipo · SmartClarity &amp; eCLARITI
        </div>
      </div>
    </div>
  `;
}
