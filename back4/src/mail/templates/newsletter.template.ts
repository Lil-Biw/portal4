import { e } from './html-escape';

export interface BloqueRender {
  titulo: string;
  cuerpo: string;
  imagenes: string[];
}

function parrafosHtml(cuerpo: string): string {
  return cuerpo
    .split(/\n\s*\n/)
    .map(p => `<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#363d44;margin:0 0 14px">${e(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function imagenesColumnaHtml(imagenes: string[]): string {
  if (imagenes.length === 0) return '';
  return imagenes
    .map(src => `<img src="${e(src)}" alt="" width="280" style="display:block;width:100%;max-width:280px;height:auto;margin:0 auto 10px;border-radius:10px;border:1px solid #eef2f7" />`)
    .join('');
}

/**
 * Corta por cantidad de caracteres (aprox. 5 líneas visuales), no por saltos
 * de línea del texto guardado — contar `\n` crudos es inconsistente porque un
 * párrafo largo sin saltos internos cuenta como "una línea" aunque ocupe
 * varias al renderizarse. Conserva los párrafos completos que entran en el
 * presupuesto y corta el último en el espacio más cercano al límite.
 *
 * Cuenta y corta por code point (`Array.from`), no por índice de string: el
 * texto de estos newsletters va cargado de emojis, y `string.length`/slice
 * cuentan unidades UTF-16 (cada emoji fuera del BMP ocupa 2), lo que además
 * de descuadrar el presupuesto puede partir un emoji a la mitad.
 */
function truncarPorCaracteres(cuerpo: string, maxChars: number): { resumen: string; truncado: boolean } {
  if (Array.from(cuerpo).length <= maxChars) return { resumen: cuerpo, truncado: false };

  const parrafos = cuerpo.split(/\n\s*\n/);
  const resultado: string[] = [];
  let acumulado = 0;

  for (const parrafo of parrafos) {
    const restante = maxChars - acumulado;
    if (restante <= 0) break;

    const unidades = Array.from(parrafo);
    if (unidades.length <= restante) {
      resultado.push(parrafo);
      acumulado += unidades.length + 2;
      continue;
    }

    const candidato = unidades.slice(0, restante).join('');
    let corte = candidato.lastIndexOf(' ');
    if (corte <= 0) corte = candidato.length;
    resultado.push(`${candidato.slice(0, corte).trimEnd()}…`);
    acumulado = maxChars;
    break;
  }

  return { resumen: resultado.join('\n\n'), truncado: true };
}

/**
 * Bloque de newsletter para correo: solo se muestra el primer párrafo del
 * texto (resumen) con un link "Seguir leyendo →" hacia el newsletter completo
 * en el portal — Gmail elimina <details>/<summary> y los <input> de los
 * correos, así que un acordeón real no es viable ahí; este patrón (resumen +
 * link) es el estándar de la industria y funciona igual en todos los
 * clientes. El link ancla al bloque (#bloque-N) en la página completa.
 * Dentro, texto e imagen van lado a lado (50/50), alternando el orden en
 * cada bloque. Usa tabla con atributo width (no solo CSS) para que Outlook
 * y clientes móviles respeten las columnas. Si el bloque no tiene imágenes,
 * el texto ocupa todo el ancho.
 */
export function bloqueEmailHtml(
  bloque: BloqueRender,
  index: number,
  newsletterUrl: string,
  opts: { truncar?: boolean } = {},
): string {
  const truncar = opts.truncar !== false;
  const titulo = `<div style="font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:18px;color:#002c51;padding-bottom:8px">${e(bloque.titulo)}</div>`;

  let resumen = bloque.cuerpo;
  let leerMas = '';
  let imagenesMostradas = bloque.imagenes;

  if (truncar) {
    // Aprox. 5 líneas visuales: columna angosta (con foto, 50% del ancho) vs. ancho completo (sin foto).
    const MAX_CHARS = bloque.imagenes.length > 0 ? 200 : 430;
    const { resumen: textoTruncado, truncado: hayMasTexto } = truncarPorCaracteres(bloque.cuerpo, MAX_CHARS);
    resumen = textoTruncado;

    const fotosExtra = Math.max(0, bloque.imagenes.length - 1);
    imagenesMostradas = bloque.imagenes.slice(0, 1);

    const etiquetaLink = fotosExtra > 0 ? `Seguir leyendo (+${fotosExtra} foto${fotosExtra > 1 ? 's' : ''}) →` : 'Seguir leyendo →';
    leerMas = (hayMasTexto || fotosExtra > 0) && newsletterUrl
      ? `<a href="${e(newsletterUrl)}#bloque-${index}" style="display:inline-block;margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#0095d6;text-decoration:none">${etiquetaLink}</a>`
      : '';
  }

  const texto = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#363d44">${parrafosHtml(resumen)}</div>`;
  const imagenes = imagenesColumnaHtml(imagenesMostradas);

  let contenido: string;
  if (!imagenes) {
    contenido = `<div style="padding-top:10px">${texto}${leerMas}</div>`;
  } else {
    // Bloques pares: texto izquierda, imagen derecha. Impares: al revés.
    const textoPrimero = index % 2 === 0;
    const cellTexto = `<td width="50%" valign="top" style="padding:${textoPrimero ? '0 12px 0 0' : '0 0 0 12px'}">${texto}${leerMas}</td>`;
    const cellImagen = `<td width="50%" valign="top" style="padding:${textoPrimero ? '0 0 0 12px' : '0 12px 0 0'}">${imagenes}</td>`;

    contenido = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:10px 0 0;border-collapse:collapse">
        <tr>
          ${textoPrimero ? cellTexto + cellImagen : cellImagen + cellTexto}
        </tr>
      </table>`;
  }

  return `<div id="bloque-${index}" style="padding:4px 0">${titulo}${contenido}</div>`;
}

export function newsletterHtml(params: {
  destinatario: string;
  titulo: string;
  tagline?: string;
  bloques: BloqueRender[];
  newsletterUrl: string;
  logoUrl: string;
}): string {
  const tagline = params.tagline
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#aedbfb;margin-top:12px;line-height:1.5">${e(params.tagline)}</div>`
    : '';

  const bloques = params.bloques
    .map((b, i) => `${i > 0 ? '<div style="border-top:1px solid #e5e7eb;margin:18px 0 0"></div>' : ''}${bloqueEmailHtml(b, i, params.newsletterUrl)}`)
    .join('');

  const logoImg = `<img src="${e(params.logoUrl)}" alt="SmartClarity" style="height:36px;width:auto;vertical-align:middle;margin-right:10px"><span style="font-size:15px;font-weight:700;color:#0095d6;vertical-align:middle">SmartClarity</span>`;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f6f8fa;padding:24px 12px;color:#363d44">
      <div style="max-width:700px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.04)">

        <div style="background:#162640;padding:40px 30px 32px;text-align:center">
          <div style="font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:22px;color:#ffffff;letter-spacing:-0.3px;line-height:1.3">⚡ NEWSLETTER SMARTCLARITY &amp; eCLARITI</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#aedbfb;margin-top:12px;line-height:1.5">${e(params.titulo)}</div>
          ${tagline}
        </div>

        <div style="padding:28px 30px 8px">
          ${bloques}
        </div>

        <div style="padding:18px 30px;background:#f9fafb;border-top:1px solid #e5e7eb">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            <tr>
              <td style="vertical-align:middle;text-align:left">${logoImg}</td>
              <td style="vertical-align:middle;text-align:right;font-size:11px;color:#9ca3af;white-space:nowrap">Comunicación interna del equipo</td>
            </tr>
          </table>
        </div>

      </div>
    </div>
  `;
}
