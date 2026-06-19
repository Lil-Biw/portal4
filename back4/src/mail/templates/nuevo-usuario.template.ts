import { e } from './html-escape';
import { SC_LOGO_HTML } from './logo';

export function nuevoUsuarioHtml(params: {
  nombre: string;
  email: string;
  password: string;
  portalUrl: string;
}): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">

      <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e5e7eb">
        <tr>
          <td style="padding:18px 24px;vertical-align:middle">
            ${SC_LOGO_HTML}
          </td>
          <td style="padding:18px 24px;vertical-align:middle;text-align:right;white-space:nowrap">
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.4px;text-transform:uppercase;background:#E6F1FB;color:#185FA5">Acceso creado</span>
          </td>
        </tr>
      </table>

      <div style="padding:24px 24px">
        <div style="display:flex;align-items:flex-start">
          <div style="width:42px;height:42px;min-width:42px;border-radius:50%;background:#E6F1FB;flex-shrink:0;font-size:22px;line-height:42px;text-align:center;margin-right:14px;overflow:hidden">👤</div>
          <div>
            <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 6px">Hola, ${e(params.nombre)}</p>
            <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.4">Tu cuenta en el Portal SmartClarity ha sido creada. Aquí están tus credenciales de acceso.</p>
          </div>
        </div>
      </div>

      <div style="border-top:1px solid #e5e7eb"></div>

      <div style="display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #e5e7eb">
        <div style="width:32px;height:32px;border-radius:8px;background:#E6F1FB;flex-shrink:0;font-size:16px;line-height:32px;text-align:center;margin-right:12px">✉️</div>
        <div>
          <p style="font-size:11px;color:#6b7280;margin:0 0 2px">Correo electrónico</p>
          <p style="font-size:14px;font-weight:500;color:#111827;margin:0">${e(params.email)}</p>
        </div>
      </div>

      <div style="display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #e5e7eb">
        <div style="width:32px;height:32px;border-radius:8px;background:#E6F1FB;flex-shrink:0;font-size:16px;line-height:32px;text-align:center;margin-right:12px">🔑</div>
        <div>
          <p style="font-size:11px;color:#6b7280;margin:0 0 2px">Contraseña temporal</p>
          <p style="font-size:14px;font-weight:500;color:#111827;margin:0;font-family:monospace;letter-spacing:2px">${e(params.password)}</p>
        </div>
      </div>

      <div style="padding:18px 24px">
        <a href="${e(params.portalUrl)}/login-consumidor"
           style="display:inline-flex;align-items:center;gap:6px;background:#0095d6;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700">
          Ingresar al portal →
        </a>
        <p style="font-size:12px;color:#6b7280;margin:8px 0 0;line-height:1.4">Cambia tu contraseña en el primer ingreso.</p>
      </div>

    </div>
  `;
}
