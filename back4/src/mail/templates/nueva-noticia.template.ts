const SECCION_LABEL: Record<string, string> = {
  novedades:  'Novedades',
  normativas: 'Normativas',
  anuncios:   'Anuncios',
};

const SECCION_COLOR: Record<string, string> = {
  novedades:  '#0095d6',
  normativas: '#d97706',
  anuncios:   '#16a34a',
};

export function nuevaNoticiaHtml(params: {
  destinatario: string;
  titulo: string;
  resumen: string;
  enlace: string;
  seccion: string;
  portalUrl: string;
}): string {
  const label = SECCION_LABEL[params.seccion] ?? params.seccion;
  const color = SECCION_COLOR[params.seccion] ?? '#0095d6';

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
      <img src="https://smartclarity.cl/SM_logo_2líneas.png" alt="SmartClarity" style="height:40px;margin-bottom:24px" />

      <span style="display:inline-block;background:${color}18;color:${color};font-size:12px;font-weight:700;
                   text-transform:uppercase;letter-spacing:.6px;padding:4px 10px;border-radius:20px;margin-bottom:16px">
        ${label}
      </span>

      <h2 style="color:#1f2937;margin:0 0 8px;font-size:1.2rem">${params.titulo}</h2>
      <p style="color:#374151;margin:0 0 24px;font-size:.9rem;line-height:1.6">${params.resumen}</p>

      <a href="${params.enlace}" target="_blank"
         style="display:inline-block;background:${color};color:#fff;text-decoration:none;
                padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-bottom:24px">
        Ver publicación
      </a>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px" />

      <p style="color:#9ca3af;font-size:12px;margin:0">
        Recibiste este correo porque eres parte del Portal SmartClarity.
        <a href="${params.portalUrl}/noticias" style="color:#0095d6">Ver todas las noticias</a>
      </p>
    </div>
  `;
}
