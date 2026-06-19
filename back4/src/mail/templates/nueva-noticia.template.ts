import { e } from './html-escape';
import { SC_LOGO_HTML } from './logo';

const SECCION_LABEL: Record<string, string> = {
  novedades:  'Novedades',
  normativas: 'Normativas',
  anuncios:   'Anuncios',
};

const SECCION_COLOR: Record<string, { bg: string; text: string; btn: string }> = {
  novedades:  { bg: '#E6F1FB', text: '#185FA5', btn: '#0095d6' },
  normativas: { bg: '#FAEEDA', text: '#633806', btn: '#BA7517' },
  anuncios:   { bg: '#EAF3DE', text: '#27500A', btn: '#3B6D11' },
};

const DEFAULT_COLOR = { bg: '#E6F1FB', text: '#185FA5', btn: '#0095d6' };

export function nuevaNoticiaHtml(params: {
  destinatario: string;
  titulo: string;
  resumen: string;
  enlace: string;
  seccion: string;
  portalUrl: string;
  imagenUrl?: string;
}): string {
  const label = e(SECCION_LABEL[params.seccion] ?? params.seccion);
  const color = SECCION_COLOR[params.seccion] ?? DEFAULT_COLOR;

  const imagenBlock = params.imagenUrl
    ? `<div style="border-bottom:1px solid #e5e7eb">
        <img src="${e(params.imagenUrl)}" alt="${e(params.titulo)}"
             style="display:block;width:100%;max-height:280px;object-fit:cover" />
       </div>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">

      <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e5e7eb">
        <tr>
          <td style="padding:18px 24px;vertical-align:middle">
            ${SC_LOGO_HTML}
          </td>
          <td style="padding:18px 24px;vertical-align:middle;text-align:right;white-space:nowrap">
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.4px;text-transform:uppercase;background:${color.bg};color:${color.text}">${label}</span>
          </td>
        </tr>
      </table>

      ${imagenBlock}

      <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb">
        <p style="font-size:16px;font-weight:700;color:#111827;margin:0 0 8px;line-height:1.35">${e(params.titulo)}</p>
        <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.6">${e(params.resumen)}</p>
      </div>

      <div style="padding:18px 24px;display:flex;align-items:center;justify-content:space-between">
        <a href="${e(params.enlace)}" target="_blank"
           style="display:inline-flex;align-items:center;gap:6px;background:${color.btn};color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700">
          Ver publicación ↗
        </a>
      </div>

      <div style="padding:12px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between">
        <p style="font-size:11px;color:#9ca3af;margin:0">Eres parte del Portal SmartClarity</p>
        <a href="${e(params.portalUrl)}/noticias" style="font-size:11px;color:#0095d6;text-decoration:none">Ver todas las noticias</a>
      </div>

    </div>
  `;
}
