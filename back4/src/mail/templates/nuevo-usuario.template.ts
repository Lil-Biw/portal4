export function nuevoUsuarioHtml(params: {
  nombre: string;
  email: string;
  password: string;
  portalUrl: string;
}): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">

      <div style="padding:18px 24px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:9px;height:9px;background:#0095d6;border-radius:50%"></div>
          <span style="font-size:15px;font-weight:700;color:#0095d6">SmartClarity</span>
        </div>
        <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.4px;text-transform:uppercase;background:#E6F1FB;color:#185FA5">Acceso creado</span>
      </div>

      <div style="padding:20px 24px">
        <div style="display:flex;align-items:flex-start;gap:14px">
          <div style="width:42px;height:42px;border-radius:50%;background:#E6F1FB;color:#185FA5;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px">
            <img src="https://api.iconify.design/tabler/user.svg?color=%23185FA5" width="22" height="22" alt="" />
          </div>
          <div>
            <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 2px">Hola, ${params.nombre}</p>
            <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.4">Tu cuenta en el Portal SmartClarity ha sido creada. Aquí están tus credenciales de acceso.</p>
          </div>
        </div>
      </div>

      <div style="border-top:1px solid #e5e7eb"></div>

      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #e5e7eb">
        <div style="width:32px;height:32px;border-radius:8px;background:#E6F1FB;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <img src="https://api.iconify.design/tabler/mail.svg?color=%23185FA5" width="18" height="18" alt="" />
        </div>
        <div>
          <p style="font-size:11px;color:#6b7280;margin:0 0 2px">Correo electrónico</p>
          <p style="font-size:14px;font-weight:500;color:#111827;margin:0">${params.email}</p>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #e5e7eb">
        <div style="width:32px;height:32px;border-radius:8px;background:#E6F1FB;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <img src="https://api.iconify.design/tabler/lock.svg?color=%23185FA5" width="18" height="18" alt="" />
        </div>
        <div>
          <p style="font-size:11px;color:#6b7280;margin:0 0 2px">Contraseña temporal</p>
          <p style="font-size:14px;font-weight:500;color:#111827;margin:0;font-family:monospace;letter-spacing:2px">${params.password}</p>
        </div>
      </div>

      <div style="padding:18px 24px;display:flex;align-items:center;justify-content:space-between">
        <a href="${params.portalUrl}/login-consumidor"
           style="display:inline-flex;align-items:center;gap:6px;background:#0095d6;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700">
          Ingresar al portal →
        </a>
        <p style="font-size:12px;color:#6b7280;margin:0;max-width:180px;line-height:1.4">Cambia tu contraseña en el primer ingreso.</p>
      </div>

    </div>
  `;
}
