import { e } from './html-escape';

// Contexto de empresa/centro/proyecto de un evento notificado. `centro` puede
// ser una lista de nombres separados por coma cuando un proyecto abarca varios
// centros.
export interface ContextoJerarquico {
  empresa: string;
  centro?: string;
  proyecto?: string;
}

// Etiqueta de la entidad más específica del evento (la que se resalta en el
// cuerpo del correo, ej. "Proyecto: Torre Sur").
export function tituloJerarquia(ctx: ContextoJerarquico): string {
  if (ctx.proyecto) return `Proyecto: ${ctx.proyecto}`;
  if (ctx.centro)   return `Centro: ${ctx.centro}`;
  return `Empresa: ${ctx.empresa}`;
}

// Partes de la ubicación completa (Empresa → Centro → Proyecto), compartidas
// entre la versión HTML (cuerpo) y la versión texto plano (asunto).
function partesJerarquia(ctx: ContextoJerarquico): string[] {
  const partes = [`Empresa: ${ctx.empresa}`];
  if (ctx.centro)   partes.push(`Centro: ${ctx.centro}`);
  if (ctx.proyecto) partes.push(`Proyecto: ${ctx.proyecto}`);
  return partes;
}

// Línea de ubicación completa (Empresa → Centro → Proyecto) para que el
// destinatario sepa de un vistazo dónde ocurrió el evento, sin tener que
// inferirlo solo del nombre del centro o proyecto.
export function breadcrumbJerarquiaHtml(ctx: ContextoJerarquico): string {
  const partes = partesJerarquia(ctx);
  return `<p style="font-size:12px;color:#9ca3af;margin:4px 0 0;line-height:1.4">${partes.map(p => e(p)).join(' &rarr; ')}</p>`;
}

// Misma cadena Empresa → Centro → Proyecto en texto plano, para usar en el
// asunto del correo (que hoy solo mostraba el nivel más específico).
export function breadcrumbJerarquiaTexto(ctx: ContextoJerarquico): string {
  return partesJerarquia(ctx).join(' → ');
}
