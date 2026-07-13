import { e } from './html-escape';

// Bloque con los nombres de los documentos adjuntos a una actividad.
// Solo nombres: el contenido debe revisarse en el portal, por eso la nota al pie.
export function bloqueDocumentosAdjuntosHtml(documentos: string[]): string {
  if (!documentos.length) return '';
  return `
    <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb">
      <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin:0 0 8px">Documentos adjuntos</p>
      ${documentos.map(d => `
        <p style="font-size:13px;color:#111827;margin:0 0 4px;line-height:1.4">📄 ${e(d)}</p>`).join('')}
      <p style="font-size:12px;color:#9ca3af;margin:6px 0 0;line-height:1.4">Revísalos en la actividad dentro del portal.</p>
    </div>`;
}
