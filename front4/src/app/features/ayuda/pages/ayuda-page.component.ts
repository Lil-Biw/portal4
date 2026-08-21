import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

type NodeId = 'empresa' | 'centro' | 'proyecto' | 'activos' | 'actividades';

interface NodeDetail {
  icon: string;
  title: string;
  body: string;
}

interface Slide {
  title: string;
  src: string;
}

interface FaqItem {
  q: string;
  a: string;
}

interface CalendarCell {
  label: string;
  hasActivity: boolean;
}

const FW = 1200;
const FH = 480;

function absPos(px: { left: number; top: number; width: number; height: number }): Record<string, string> {
  return {
    position: 'absolute',
    left: `${(px.left / FW) * 100}%`,
    top: `${(px.top / FH) * 100}%`,
    width: `${(px.width / FW) * 100}%`,
    height: `${(px.height / FH) * 100}%`,
  };
}

const NODE_DETAILS: Record<NodeId, NodeDetail> = {
  empresa: {
    icon: 'building-2',
    title: 'Empresa',
    body: 'El nivel raíz del portal y su principal almacenamiento de documentos. Agrupa todos los centros de costo, proyectos, activos y actividades de un cliente.',
  },
  centro: {
    icon: 'map-pin',
    title: 'Centro de costo',
    body: 'Una planta, faena o sucursal dentro de la empresa. Tiene su propio almacenamiento de documentos y agrupa proyectos y activos.',
  },
  proyecto: {
    icon: 'folder',
    title: 'Proyectos',
    body: 'Trabajos específicos dentro de un centro de costo, por ejemplo una auditoría o una obra. Cada proyecto tiene su propio almacenamiento de documentos: planos, informes y registros.',
  },
  activos: {
    icon: 'cpu',
    title: 'Activos',
    body: 'Equipos y maquinaria de un centro de costo. Cada activo tiene su propia ficha y su propio almacenamiento de documentos: manuales, mantenciones y certificados.',
  },
  actividades: {
    icon: 'calendar-clock',
    title: 'Actividades',
    body: 'Se arma combinando centros de costo y activos de la empresa, y pertenece directamente a la empresa. Cada actividad tiene su propio almacenamiento de documentos, como registros y evidencia.',
  },
};

const SLIDES_DATA: Slide[] = [
  { title: 'Inicio', src: '/videos/tab-01-inicio.mp4' },
  { title: 'Empresas', src: '/videos/tab-02-empresas.mp4' },
  { title: 'Centros de costo', src: '/videos/tab-03-centros.mp4' },
  { title: 'Proyectos: tipos', src: '/videos/tab-04a-proyectos-tipos.mp4' },
  { title: 'Proyectos: estados', src: '/videos/tab-04b-proyectos-estados.mp4' },
  { title: 'Actividades', src: '/videos/tab-05-actividades.mp4' },
  { title: 'Documentos: documentación', src: '/videos/tab-06a-documentos-documentacion.mp4' },
  { title: 'Documentos: solicitudes', src: '/videos/tab-06b-documentos-solicitudes.mp4' },
  { title: 'Documentos: subir archivos', src: '/videos/tab-06c-documentos-subir.mp4' },
  { title: 'Activos', src: '/videos/tab-07-activos.mp4' },
  { title: 'Usuarios', src: '/videos/tab-08-usuarios.mp4' },
  { title: 'Noticias', src: '/videos/tab-09-noticias.mp4' },
];

const FAQ_DATA: FaqItem[] = [
  {
    q: '¿Cuál es la diferencia entre empresa, centro de costo y proyecto?',
    a: 'Empresa es el nivel raíz. Centro de costo es una planta o faena dentro de esa empresa. Proyecto es un trabajo específico dentro de un centro, con sus propios documentos.',
  },
  {
    q: '¿Dónde quedan los documentos de un activo?',
    a: 'Cada activo tiene su propio espacio de documentos, dentro del centro de costo al que pertenece. No se mezclan con los documentos generales del centro.',
  },
  {
    q: '¿Qué es una actividad y cómo se crea?',
    a: 'Una actividad se arma eligiendo un centro de costo y uno o más activos de esa empresa. Agrupa el trabajo y los documentos de una tarea puntual, como una mantención, sin depender de un solo activo.',
  },
  {
    q: '¿Quién puede ver los documentos que subo?',
    a: 'Depende de los permisos del usuario dentro de la empresa. Los administradores ven todo; los demás usuarios ven solo lo que se les asigna.',
  },
  {
    q: '¿Puedo mover un documento entre proyectos o activos?',
    a: 'Cada documento pertenece a un solo espacio a la vez. Para reubicarlo, sube una copia en el nuevo espacio y elimina la anterior si ya no la necesitas.',
  },
  {
    q: '¿Cómo respaldo mis documentos?',
    a: 'Entra a Documentos y usa la opción de exportar o descargar el respaldo del centro, proyecto o activo que necesites.',
  },
];

const ACTIVITY_DAYS = [3, 9, 14, 20, 22, 27];
const CALENDAR_LEAD_BLANKS = 5;
const CALENDAR_DAYS_IN_MONTH = 31;

const ICON_PATHS: Record<string, string> = {
  'building-2':
    '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4"/><path d="M9 6h.01"/><path d="M9 10h.01"/><path d="M9 14h.01"/><path d="M15 6h.01"/><path d="M15 10h.01"/><path d="M15 14h.01"/>',
  'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>',
  'calendar-clock':
    '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="17.5" cy="17.5" r="4.5"/><path d="M17.5 16v1.3l1 1"/>',
  'chevron-left': '<polyline points="15 18 9 12 15 6"/>',
  'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
  'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
};

function iconSvg(name: string, size: number, fill = 'none'): string {
  const inner = ICON_PATHS[name] ?? '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

@Component({
  selector: 'app-ayuda-page',
  standalone: true,
  imports: [],
  templateUrl: './ayuda-page.component.html',
  styles: [`
    :host { display: block; }

    .page { display: flex; flex-direction: column; gap: 2.25rem; }

    /* ── Header ─────────────────────────────────────── */
    .page-header h2 { margin: 0 0 .25rem; font-size: 1.5rem; font-weight: 700; color: var(--fg-1); letter-spacing: -.01em; }
    .page-header p { margin: 0; font-size: .875rem; color: var(--fg-4); }

    /* ── Secciones genéricas ────────────────────────── */
    .section-title { margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--fg-1); font-family: var(--font-display); }
    .section-sub { margin: .4rem 0 0; font-size: .875rem; color: var(--fg-4); line-height: 1.5; }

    /* ── Estructura: leyenda ────────────────────────── */
    .legend { display: flex; gap: 1rem; margin-top: .9rem; font-size: .78rem; color: var(--fg-5); }
    .legend-item { display: flex; align-items: center; gap: .4rem; }
    .legend-line { width: 22px; height: 2px; background: var(--fg-5); display: inline-block; }
    .legend-line--dashed { background-image: linear-gradient(to right, var(--fg-5) 60%, transparent 40%); background-size: 6px 2px; background-color: transparent; }

    /* ── Diagrama ───────────────────────────────────── */
    .diagram { position: relative; width: 100%; max-width: 1020px; aspect-ratio: 1200 / 480; margin: 1.5rem auto 0; }
    .diagram svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .docs-group {
      position: absolute;
      border: 1.5px solid rgba(0, 174, 239, 0.45);
      border-radius: var(--radius-lg);
      background: rgba(0, 174, 239, 0.04);
    }
    .docs-group-label {
      position: absolute;
      top: -11px;
      left: 16px;
      padding: .15rem .6rem;
      font-size: .72rem;
      font-weight: 700;
      letter-spacing: .03em;
      color: var(--sc-cyan-pressed);
      background: var(--bg-0);
      border-radius: var(--radius-pill);
    }
    .diagram-box {
      display: flex; align-items: center; justify-content: center; gap: .5rem;
      border-radius: var(--radius-lg); cursor: pointer; font-family: var(--font-body);
      transition: box-shadow .15s, border-color .15s; padding: 0;
    }
    .diagram-box span { font-size: .875rem; font-weight: 700; }
    .actividades-wrap { display: flex; flex-direction: column; }
    .actividades-box {
      display: flex; align-items: center; gap: .6rem; padding: .85rem 1rem; border-radius: var(--radius-lg);
      cursor: pointer; background: var(--bg-0); transition: box-shadow .15s, border-color .15s; flex: none;
      font-family: var(--font-body); text-align: left;
    }
    .actividades-box strong { display: block; font-size: .875rem; font-weight: 700; color: var(--fg-1); }
    .actividades-box small { display: block; font-size: .72rem; color: var(--fg-5); margin-top: .1rem; }

    .mini-calendar {
      background: var(--bg-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);
      padding: 1rem; margin-top: .85rem; flex: 1; display: flex; flex-direction: column;
    }
    .mini-calendar-head { display: flex; align-items: center; justify-content: space-between; }
    .mini-calendar-head span { color: var(--fg-5); display: flex; }
    .mini-calendar-head strong { font-size: .875rem; font-weight: 700; color: var(--fg-1); }
    .mini-calendar-weekdays, .mini-calendar-grid {
      display: grid; grid-template-columns: repeat(7, 1fr); gap: .3rem;
    }
    .mini-calendar-weekdays { margin-top: 1rem; font-size: .68rem; font-weight: 700; color: var(--fg-5); text-align: center; }
    .mini-calendar-grid { grid-auto-rows: 1fr; gap: .35rem; margin-top: .5rem; flex: 1; }
    .mini-calendar-cell {
      display: flex; align-items: center; justify-content: center; font-size: .72rem; border-radius: var(--radius-sm); color: var(--fg-2);
    }
    .mini-calendar-cell.has-activity { background: var(--sc-cyan); color: var(--fg-inverse); font-weight: 700; }

    .node-detail {
      background: var(--bg-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);
      padding: 1.25rem; margin-top: 1rem; display: flex; gap: 1rem; align-items: flex-start;
    }
    .node-detail-icon {
      width: 40px; height: 40px; flex: none; border-radius: var(--radius-sm);
      background: var(--sc-cyan-tint-6); color: var(--sc-cyan); display: flex; align-items: center; justify-content: center;
    }
    .node-detail h4 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--fg-1); }
    .node-detail p { margin: .4rem 0 0; font-size: .875rem; line-height: 1.55; color: var(--fg-4); max-width: 620px; }

    /* ── Videos ─────────────────────────────────────── */
    .video-section { display: flex; gap: 1.5rem; align-items: flex-start; margin-top: 1rem; }
    .video-list {
      flex: 0 0 260px; display: flex; flex-direction: column; gap: .3rem;
      max-height: 520px; overflow-y: auto;
    }
    .video-list-item {
      display: flex; align-items: center; gap: .65rem; padding: .55rem .7rem; border-radius: var(--radius-sm);
      border: 1px solid transparent; background: transparent; cursor: pointer; text-align: left;
      font-family: var(--font-body); transition: background .15s, border-color .15s;
    }
    .video-list-item:hover { background: var(--bg-1); }
    .video-list-item.active { background: var(--sc-cyan-tint-6); border-color: var(--sc-cyan); }
    .video-list-index {
      flex: none; width: 22px; height: 22px; border-radius: var(--radius-pill); background: var(--bg-1);
      color: var(--fg-5); font-size: .7rem; font-weight: 700; display: flex; align-items: center; justify-content: center;
    }
    .video-list-item.active .video-list-index { background: var(--sc-cyan); color: var(--fg-inverse); }
    .video-list-title { font-size: .82rem; font-weight: 600; color: var(--fg-2); line-height: 1.3; }
    .video-list-item.active .video-list-title { color: var(--fg-1); }

    .video-shell { position: relative; flex: 1 1 auto; min-width: 0; max-width: 760px; margin: 0 auto; }
    .video-frame {
      position: relative; aspect-ratio: 16 / 9; border-radius: var(--radius-lg); overflow: hidden;
      background: var(--bg-dark);
    }
    .video-player { width: 100%; height: 100%; display: block; object-fit: contain; background: var(--bg-dark); }
    .video-caption {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: .7rem; padding: 0 .25rem;
    }
    .video-caption strong { font-size: .95rem; font-weight: 700; color: var(--fg-1); }
    .video-count { font-size: .75rem; font-weight: 700; color: var(--fg-5); white-space: nowrap; }
    .video-nav {
      position: absolute; top: 50%; transform: translateY(-50%); width: 38px; height: 38px; border-radius: var(--radius-pill);
      background: var(--bg-0); border: 1px solid var(--border-default); box-shadow: var(--shadow-1);
      display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--fg-1);
    }
    .video-nav.prev { left: 12px; }
    .video-nav.next { right: 12px; }

    @media (max-width: 760px) {
      .video-section { flex-direction: column; }
      .video-list { flex-direction: row; flex-basis: auto; width: 100%; max-height: none; overflow-x: auto; overflow-y: visible; }
      .video-list-item { flex: none; }
      .video-list-title { white-space: nowrap; }
      .video-shell { max-width: none; width: 100%; }
    }

    /* ── FAQ ────────────────────────────────────────── */
    .faq-list { display: flex; flex-direction: column; gap: .6rem; margin-top: 1rem; }
    .faq-item { background: var(--bg-0); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); overflow: hidden; }
    .faq-question {
      display: flex; align-items: center; justify-content: space-between; gap: .75rem; width: 100%;
      border: none; background: transparent; cursor: pointer; padding: 1rem 1.15rem; text-align: left; font-family: var(--font-body);
    }
    .faq-question span { font-size: .875rem; font-weight: 700; color: var(--fg-1); line-height: 1.4; }
    .faq-chevron { display: flex; flex: none; color: var(--fg-5); transition: transform .15s; }
    .faq-chevron.open { transform: rotate(180deg); }
    .faq-answer { padding: 0 1.15rem 1.15rem; font-size: .875rem; line-height: 1.6; color: var(--fg-4); }

    /* ── Soporte ────────────────────────────────────── */
    .support-banner {
      background: linear-gradient(135deg, var(--sc-cyan) 0%, var(--sc-cyan-pressed) 100%);
      border-radius: var(--radius-lg); padding: 1.5rem 1.75rem; display: flex; align-items: center;
      justify-content: space-between; gap: 1.25rem; flex-wrap: wrap; box-shadow: var(--shadow-1);
    }
    .support-banner strong { display: block; font-size: 1rem; font-weight: 700; color: #fff; }
    .support-banner p { margin: .15rem 0 0; font-size: .82rem; color: rgba(255,255,255,.85); }
    .support-cta {
      display: flex; align-items: center; gap: .5rem; padding: .65rem 1.25rem; border-radius: var(--radius-pill);
      background: #fff; color: var(--sc-cyan-pressed); font-size: .85rem; font-weight: 700; text-decoration: none;
      white-space: nowrap; flex-shrink: 0;
    }
  `],
})
export class AyudaPageComponent {
  private readonly sanitizer = inject(DomSanitizer);

  private readonly safeIcons = new Map<string, SafeHtml>(
    ([
      ['building-2', iconSvg('building-2', 20)],
      ['map-pin', iconSvg('map-pin', 20)],
      ['folder', iconSvg('folder', 20)],
      ['cpu', iconSvg('cpu', 20)],
      ['calendar-clock', iconSvg('calendar-clock', 22)],
      ['chevron-left-16', iconSvg('chevron-left', 16)],
      ['chevron-right-16', iconSvg('chevron-right', 16)],
      ['chevron-left-18', iconSvg('chevron-left', 18)],
      ['chevron-right-18', iconSvg('chevron-right', 18)],
      ['chevron-down', iconSvg('chevron-down', 18)],
      ['play', iconSvg('play', 24)],
      ['mail', iconSvg('mail', 15)],
    ] as const).map(([key, svg]) => [key, this.sanitizer.bypassSecurityTrustHtml(svg)]),
  );

  getIcon(key: string): SafeHtml {
    return this.safeIcons.get(key) ?? this.sanitizer.bypassSecurityTrustHtml('');
  }

  readonly nodeDetails = NODE_DETAILS;
  readonly slidesData = SLIDES_DATA;
  readonly faqData = FAQ_DATA;
  readonly weekdayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  readonly calendarDays: CalendarCell[] = this.buildCalendarDays();

  readonly selectedNode = signal<NodeId>('empresa');
  readonly slideIndex = signal(0);
  readonly faqOpen = signal(0);

  readonly nodeDetail = computed(() => this.nodeDetails[this.selectedNode()]);
  readonly currentSlide = computed(() => this.slidesData[this.slideIndex()]);

  readonly empresaBoxStyle = computed(() => this.boxStyle('empresa', true, { left: 250, top: 25, width: 220, height: 60 }));
  readonly centroBoxStyle = computed(() => this.boxStyle('centro', false, { left: 240, top: 180, width: 240, height: 60 }));
  readonly proyectoBoxStyle = computed(() => this.boxStyle('proyecto', false, { left: 90, top: 370, width: 220, height: 60 }));
  readonly activosBoxStyle = computed(() => this.boxStyle('activos', false, { left: 560, top: 370, width: 220, height: 60 }));
  readonly actividadesWrapStyle = absPos({ left: 850, top: 40, width: 300, height: 390 });
  readonly docsGroupStyle = absPos({ left: 50, top: 12, width: 470, height: 440 });
  readonly activosGroupStyle = absPos({ left: 540, top: 350, width: 260, height: 100 });
  readonly actividadesGroupStyle = absPos({ left: 830, top: 24, width: 340, height: 420 });

  readonly actividadesBoxStyle = computed(() => {
    const active = this.selectedNode() === 'actividades';
    return {
      border: active ? '2px solid var(--warn)' : '1px solid var(--border-default)',
      'box-shadow': active ? 'var(--shadow-2)' : 'var(--shadow-1)',
    };
  });

  selectNode(id: NodeId): void {
    this.selectedNode.set(id);
  }

  prevSlide(): void {
    this.slideIndex.update((i) => (i - 1 + this.slidesData.length) % this.slidesData.length);
  }

  nextSlide(): void {
    this.slideIndex.update((i) => (i + 1) % this.slidesData.length);
  }

  goToSlide(i: number): void {
    this.slideIndex.set(i);
  }

  toggleFaq(i: number): void {
    this.faqOpen.update((cur) => (cur === i ? -1 : i));
  }

  private boxStyle(
    id: NodeId,
    dark: boolean,
    px: { left: number; top: number; width: number; height: number },
  ): Record<string, string> {
    const active = this.selectedNode() === id;
    const accent = dark ? 'var(--bg-dark)' : 'var(--sc-cyan)';
    return {
      ...absPos(px),
      background: dark ? 'var(--bg-dark)' : 'var(--bg-0)',
      color: dark ? '#fff' : 'var(--fg-1)',
      border: active ? `2px solid ${accent}` : '1px solid var(--border-default)',
      'box-shadow': active ? 'var(--shadow-2)' : 'var(--shadow-1)',
    };
  }

  private buildCalendarDays(): CalendarCell[] {
    const days: CalendarCell[] = [];
    for (let i = 0; i < CALENDAR_LEAD_BLANKS; i++) days.push({ label: '', hasActivity: false });
    for (let d = 1; d <= CALENDAR_DAYS_IN_MONTH; d++) days.push({ label: String(d), hasActivity: ACTIVITY_DAYS.includes(d) });
    return days;
  }
}
