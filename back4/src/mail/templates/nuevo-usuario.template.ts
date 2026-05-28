export function nuevoUsuarioHtml(params: {
  nombre: string;
  email: string;
  password: string;
  portalUrl: string;
}): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
      <img src="https://smartclarity.cl/SM_logo_2líneas.png" alt="SmartClarity" style="height:40px;margin-bottom:24px" />
      <h2 style="color:#1f2937;margin:0 0 8px">Hola, ${params.nombre}</h2>
      <p style="color:#374151;margin:0 0 24px">
        Tu cuenta en el Portal SmartClarity ha sido creada. A continuación encontrarás tus credenciales de acceso:
      </p>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Correo electrónico</p>
        <p style="margin:0 0 16px;font-weight:700;color:#111827">${params.email}</p>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Contraseña temporal</p>
        <p style="margin:0;font-weight:700;color:#111827;letter-spacing:1px">${params.password}</p>
      </div>
      <a href="${params.portalUrl}/login-consumidor"
         style="display:inline-block;background:#0095d6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
        Ingresar al portal
      </a>
      <p style="color:#9ca3af;font-size:12px;margin-top:32px">
        Por seguridad, te recomendamos cambiar tu contraseña después del primer ingreso.
      </p>
    </div>
  `;
}
