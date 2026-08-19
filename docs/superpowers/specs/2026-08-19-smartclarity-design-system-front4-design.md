# Aplicar el Smartclarity Design System a front4

**Fecha:** 2026-08-19
**Rama:** `feat/front4-smartclarity-design-system`
**Clasificación:** Arquitectónico (toca la base visual compartida de todo el front)

## Contexto

Existe un proyecto de Claude Design llamado **"Smartclarity Design System"**
(`projectId 019dcc9a-4dbc-72f1-b717-0b4488e4a4d8`) que documenta la identidad
visual de Smartclarity Energy (empresa B2B industrial/energía, Chile):
tokens de color/tipografía/spacing/radii/shadows (`colors_and_type.css`),
previews de componentes genéricos (botones, cards, badges, inputs, nav,
colores) y un kit de marketing para el sitio público (`ui_kits/marketing/`).

`front4` (portal de clientes, Angular 21 standalone) hoy define su propia
paleta ad-hoc en `src/styles.css` (`--accent: #0095d6`, grises genéricos,
sin sistema formal) y no tiene librería de componentes ni de íconos: todo
es CSS custom global + estilos inline por componente (`styles:` en 57
archivos `.ts` con colores hardcodeados, más 4 `.css`).

Se decidió portar la fundación visual (tokens + componentes base) del
design system al portal, sin tocar layout/estructura ni adoptar el kit de
marketing (pensado para landing pages, no para un dashboard logueado).

## Alcance

**Dentro:**
- Reemplazo completo de los tokens `:root` en `front4/src/styles.css` por
  los del design system (rename directo, sin alias de compatibilidad).
- Import de Google Fonts (Space Grotesk + DM Sans) y aplicación vía
  `--font-display`/`--font-body`.
- Reestilo de clases base compartidas: `.btn-primary/.btn-success/.btn-ghost/.btn-danger`,
  `.card`, `.field input/select/textarea`, `.estado-chip`, `.tag-empresa/.tag-centro`,
  siguiendo specs de `preview/buttons.html`, `preview/cards.html`,
  `preview/form-inputs.html`, `preview/badges.html` del design system.
- Barra de progreso del score documental: de degradado azul→verde a
  `--sc-cyan` sólido (la marca no usa gradientes en superficies UI).
- Semánticos existentes (ok/warning/danger en `stat-chip` y similares)
  migran a `--ok/--warn/--danger` del design system (convergen casi 1:1).
- Íconos del sidebar/topbar (`getIcon()` con SVG inline): reemplazo del
  contenido SVG por paths equivalentes de Lucide (stroke-width 1.75,
  `currentColor`), sin agregar dependencia npm — se copia el markup SVG
  igual que hoy, solo cambia el path data. Se mantiene la interfaz actual
  (`icon: 'dashboard'|'building'|...`).
- Todas las features (`clientes`, `centros`, `proyectos`, `usuarios`,
  `documentos`, `actividades`, `activos`, `noticias`, `ayuda`, `dashboard`)
  y `shared/components/*` (stat-chip, spider-chart, image-upload,
  crud-toolbar, status-banner) actualizan sus estilos inline para usar
  los tokens nuevos en vez de hex hardcodeados.

**Fuera:**
- Logos existentes (`smart-clarity-clean.png`, `smart-clarity-pill.png`) —
  se mantienen tal cual, no se reemplazan por los assets del design system.
- `ui_kits/marketing/` del design system — no se usa (es para el sitio
  público, no para el portal).
- Cambios de layout, composición de pantallas o spacing más allá de lo
  que ya cubren los tokens `--space-*` — esto es un reskin, no un
  rediseño de estructura.
- Dark mode — no existe en el design system fuente ni se agrega aquí.

## Mapeo de tokens

| Antes (`front4/src/styles.css`) | Después (design system) |
|---|---|
| `--accent` (#0095d6) | `--sc-cyan` (#00AEEF) |
| — | `--sc-cyan-hover` / `--sc-cyan-pressed` (hover/active de botones) |
| `--bg` (#f0f4f8) | `--bg-0` / `--bg-1` |
| `--ink-900/600/500/400` | `--fg-1/2/3/4` (+ `--fg-5` nuevo, no existía) |
| verde de `.btn-success`, `.grupo-centro`, tags | `--ok` (#2EAE6E) |
| rojo de `.btn-danger` | `--danger` (#E5484D) |
| — (no existía escala de warning) | `--warn` (#F5A524) |
| radios sueltos (8px, 14px, 16px, 999px) | `--radius-sm/md/lg/pill` |
| sombras sueltas (`0 1px 3px rgba(0,0,0,.06)`, etc.) | `--shadow-1..4` |
| `font-family: system-ui...` | `--font-display` (Space Grotesk, h1-h6) / `--font-body` (DM Sans, resto) |

## Orden de trabajo

Por lotes, verificando visualmente en el navegador (`npm start`) antes de
pasar al siguiente:

1. `front4/src/styles.css` — tokens globales + clases base compartidas.
2. `layout/` — topbar, sidebar (incluye migración de íconos a Lucide), main-layout.
3. `dashboard/` (inicio, mi-ficha, resumen) — primera vista que usa cards/spider-chart/score.
4. Resto de `features/*` — clientes, centros, proyectos, usuarios, documentos,
   actividades, activos, noticias, ayuda.
5. `shared/components/*` — stat-chip, spider-chart, image-upload, crud-toolbar, status-banner.

## Testing

- Sin tests automatizados de estilo visual (no hay snapshot testing en
  el proyecto). Verificación manual en navegador por lote, cubriendo
  modo admin y modo consumidor de cada vista tocada.
- `npm test` (Vitest) debe seguir pasando — los tests existentes no
  deberían depender de valores de color/estilo específicos, pero se
  corre igual como red de seguridad ante cambios accidentales de
  markup (p.ej. al tocar `getIcon()`).

## Riesgos conocidos

- 57 archivos `.ts` con estilos inline hardcodeados es un volumen grande;
  se prioriza consistencia visual sobre velocidad — mejor hacerlo por
  lotes verificando en navegador que arriesgar un cambio masivo sin
  revisión.
- El substituto tipográfico (Space Grotesk/DM Sans) y los íconos Lucide
  son aproximaciones del design system, no assets con licencia de marca
  confirmados — documentado como tal en el `README.md` del design system
  original; si en el futuro aparecen fuentes/íconos con licencia real,
  el reemplazo es solo en los tokens (`--font-display`/`--font-body`) y
  en el mapeo de `getIcon()`, no requiere tocar el resto del código.
