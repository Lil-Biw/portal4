import { e } from './html-escape';
import { SC_LOGO_HTML } from './logo';

export function recuperarPasswordHtml(params: {
  nombre: string;
  resetUrl: string;
}): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">

      <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e5e7eb">
        <tr>
          <td style="padding:18px 24px;vertical-align:middle">
            ${SC_LOGO_HTML}
          </td>
          <td style="padding:18px 24px;vertical-align:middle;text-align:right;white-space:nowrap">
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.4px;text-transform:uppercase;background:#FDECEC;color:#B42318">Recuperar acceso</span>
          </td>
        </tr>
      </table>

      <div style="padding:24px 24px">
        <div style="display:flex;align-items:flex-start">
          <div style="width:42px;height:42px;min-width:42px;border-radius:50%;background:#FDECEC;flex-shrink:0;font-size:22px;line-height:42px;text-align:center;margin-right:14px;overflow:hidden">🔒</div>
          <div>
            <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 6px">Hola, ${e(params.nombre)}</p>
            <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.4">Recibimos una solicitud para restablecer tu contraseña en el Portal SmartClarity. Si fuiste tú, haz clic en el botón para continuar.</p>
          </div>
        </div>
      </div>

      <div style="padding:0 24px 24px">
        <a href="${e(params.resetUrl)}"
           style="display:inline-flex;align-items:center;gap:6px;background:#0095d6;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700">
          Restablecer contraseña →
        </a>
        <p style="font-size:12px;color:#6b7280;margin:12px 0 0;line-height:1.4">
          Este enlace vence en 30 minutos y solo puede usarse una vez. Si no solicitaste este cambio, puedes ignorar este correo — tu contraseña actual seguirá funcionando.
        </p>
      </div>

    </div>
  `;
}
