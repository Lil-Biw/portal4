import { Component, OnInit, inject, signal, effect, computed, untracked } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { ActividadesService } from '../../actividades/actividades.service';
import { NoticiasService } from '../../noticias/noticias.service';
import { AuthService } from '../../auth/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { Solicitud } from '../../solicitudes/solicitudes.service';
import { Actividad, TipoActividad } from '../../../shared/models/actividad.model';
import { Noticia, SECCIONES } from '../../../shared/models/noticia.model';
import { asId } from '../../../shared/utils';

export interface AtencionItem {
  id: string;
  titulo: string;
  subtitulo: string;
  badgeLabel: string;
  badgeClass: string;
  iconBg: string;
}

export interface ProximaActividad {
  dia: string;
  mes: string;
  nombre: string;
  lugar: string;
  accentColor: string;
}

export interface ScoreEmpresa {
  nombre: string;
  score: number;
  total: number;
}

@Component({
  selector: 'app-resumen-page',
  standalone: true,
  imports: [NgClass, RouterLink],
  templateUrl: './resumen-page.component.html',
  styles: [`
    :host { display: block; }

    /* ── Página ─────────────────────────────────────── */
    .page { display: flex; flex-direction: column; gap: 1.5rem; }

    /* ── Saludo ─────────────────────────────────────── */
    .greeting h1 { margin: 0 0 .25rem; font-size: 1.75rem; font-weight: 800; color: #111827; }
    .greeting p  { margin: 0; font-size: .95rem; color: #6b7280; }

    /* ── Stats ──────────────────────────────────────── */
    .stats {
      display: grid;
      grid-template-columns: repeat(4,1fr);
      gap: 1rem;
    }
    .stat {
      background: #fff;
      border: 1px solid rgba(34,33,33,.08);
      border-radius: 16px;
      padding: 1.1rem 1.25rem;
      display: flex; flex-direction: column; gap: .5rem;
      box-sizing: border-box;
    }
    .stat-top { display: flex; align-items: center; justify-content: space-between; }
    .stat-icon {
      width: 36px; height: 36px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .stat-badge {
      font-size: .72rem; font-weight: 700;
      padding: .2rem .55rem; border-radius: 999px; white-space: nowrap;
    }
    .stat-badge.blue   { background: rgba(0,149,214,.1);  color: #0095d6; }
    .stat-badge.green  { background: rgba(22,163,74,.1);  color: #16a34a; }
    .stat-badge.purple { background: rgba(99,102,241,.1); color: #6366f1; }
    .stat-badge.amber  { background: rgba(245,158,11,.12); color: #d97706; }
    .stat-num   { font-size: 2rem; font-weight: 800; color: #111827; line-height: 1; }
    .stat-label { font-size: .82rem; color: #6b7280; font-weight: 500; }

    /* ── Grid de paneles ─────────────────────────────── */
    .panels {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: calc(50vh - 160px) calc(50vh - 160px);
      grid-auto-flow: column;
      gap: 1rem;
    }

    /* ── Panel ───────────────────────────────────────── */
    .panel {
      background: #fff;
      border: 1px solid rgba(34,33,33,.08);
      border-radius: 16px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
    }
    .panel-head {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1rem; flex-shrink: 0;
    }
    .panel-head h2 { margin: 0; font-size: 1rem; font-weight: 700; color: #111827; }
    .panel-body {
      flex: 1; overflow-y: auto; min-height: 0; padding-right: 2px;
      scrollbar-width: thin; scrollbar-color: rgba(0,0,0,.13) transparent;
    }
    .panel-body::-webkit-scrollbar       { width: 4px; }
    .panel-body::-webkit-scrollbar-track { background: transparent; }
    .panel-body::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 4px; }
    .ver-todo { font-size: .82rem; font-weight: 600; color: #0095d6; text-decoration: none; }
    .ver-todo:hover { text-decoration: underline; }

    /* ── Atención ────────────────────────────────────── */
    .aten-list { display: flex; flex-direction: column; gap: .75rem; }
    .aten-item {
      display: flex; align-items: center; gap: .85rem;
      padding: .65rem .75rem; border-radius: 10px;
      background: #fafafa; border: 1px solid rgba(34,33,33,.06);
    }
    .aten-icon {
      width: 38px; height: 38px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; opacity: .9;
    }
    .aten-body { flex: 1; min-width: 0; }
    .aten-title { font-size: .875rem; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .aten-sub   { font-size: .78rem; color: #9ca3af; margin-top: .1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* ── Badges ──────────────────────────────────────── */
    .badge { font-size: .72rem; font-weight: 700; padding: .25rem .6rem; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }
    .badge-gray   { background: #f3f4f6; color: #6b7280; }
    .badge-orange { background: rgba(245,158,11,.12); color: #d97706; }
    .badge-red    { background: rgba(239,68,68,.1); color: #dc2626; }
    .badge-green  { background: rgba(22,163,74,.1); color: #16a34a; }

    /* ── Próximas ────────────────────────────────────── */
    .prox-list { display: flex; flex-direction: column; gap: .6rem; }
    .prox-item { display: flex; align-items: flex-start; gap: .85rem; }
    .prox-fecha { display: flex; flex-direction: column; align-items: center; min-width: 36px; }
    .prox-dia { font-size: 1.15rem; font-weight: 800; color: #111827; line-height: 1; }
    .prox-mes { font-size: .65rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: .04em; }
    .prox-bar { width: 3px; border-radius: 3px; min-height: 32px; flex-shrink: 0; margin-top: .15rem; }
    .prox-body { min-width: 0; }
    .prox-nombre { font-size: .875rem; font-weight: 600; color: #111827; }
    .prox-lugar  { font-size: .78rem; color: #9ca3af; margin-top: .05rem; }

    /* ── Score ───────────────────────────────────────── */
    .score-list { display: flex; flex-direction: column; gap: .9rem; }
    .score-row  { display: flex; flex-direction: column; gap: .3rem; }
    .score-head { display: flex; justify-content: space-between; align-items: baseline; }
    .score-nom  { font-size: .82rem; font-weight: 700; color: #111827; }
    .score-num  { font-size: .95rem; font-weight: 800; }
    .score-track { height: 6px; background: #f3f4f6; border-radius: 999px; overflow: hidden; }
    .score-fill  { height: 100%; border-radius: 999px; transition: width .4s ease; }

    /* ── Noticias ────────────────────────────────────── */
    .news-list { display: flex; flex-direction: column; gap: .85rem; }
    .news-item { display: flex; align-items: flex-start; gap: .85rem; }
    .news-icon {
      width: 64px; height: 64px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .news-body  { min-width: 0; flex: 1; }
    .news-title { font-size: .88rem; font-weight: 600; color: #111827; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .news-date  { font-size: .75rem; color: #9ca3af; margin-top: .25rem; }

    .empty { font-size: .85rem; color: #9ca3af; text-align: center; padding: 1rem 0; }

    @media (max-width: 1100px) {
      .stats  { grid-template-columns: repeat(2,1fr); }
      .panels { grid-template-columns: 1fr; grid-template-rows: repeat(4, calc(50vh - 160px)); grid-auto-flow: row; }
    }
  `],
})
export class ResumenPageComponent implements OnInit {
  protected readonly clientesService    = inject(ClientesService);
  protected readonly centrosService     = inject(CentrosService);
  protected readonly proyectosService   = inject(ProyectosService);
  protected readonly usuariosService    = inject(UsuariosService);
  protected readonly actividadesService = inject(ActividadesService);
  protected readonly noticiasService    = inject(NoticiasService);
  private  readonly authService         = inject(AuthService);
  private  readonly http                = inject(HttpClient);
  private  readonly api                 = inject(ApiService);

  protected todasSolicitudes = signal<Solicitud[]>([]);
  protected loadingDocs      = signal(false);

  // ── Saludo ──────────────────────────────────────────────────────────────
  protected readonly saludo = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Buen día' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  });

  protected readonly nombreUsuario = computed(() =>
    this.authService.usuarioActual()?.nombre ?? 'Administrador'
  );

  protected readonly fechaHoy = computed(() =>
    new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
  );

  // ── Stat cards ──────────────────────────────────────────────────────────
  protected readonly empresasCount = computed(() => this.clientesService.clientes().length);
  protected readonly centrosCount  = computed(() => this.centrosService.centros().length);

  protected readonly proyectosActivosCount = computed(() =>
    this.proyectosService.proyectos().filter(p => p.estado === 'activo').length
  );

  protected readonly proyectosEsteMes = computed(() => {
    const hoy = new Date();
    return this.proyectosService.proyectos().filter(p => {
      if (!p.creado_en) return false;
      const d = new Date(p.creado_en);
      return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
    }).length;
  });

  protected readonly actividadesDelMesCount = computed(() => {
    const hoy = new Date();
    return this.actividadesService.actividades().filter(a => {
      const d = new Date(a.fecha);
      return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
    }).length;
  });

  protected readonly actividadesEstaSemanaCount = computed(() => {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    lunes.setHours(0, 0, 0, 0);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 7);
    return this.actividadesService.actividades().filter(a => {
      const d = new Date(a.fecha);
      return d >= lunes && d < domingo;
    }).length;
  });

  protected readonly docsPendientesCount = computed(() =>
    this.todasSolicitudes().filter(s => s.estado === 'pendiente').length
  );

  // ── Requiere tu atención ────────────────────────────────────────────────
  protected readonly atencionItems = computed((): AtencionItem[] => {
    const centros  = this.centrosService.centros();
    const clientes = this.clientesService.clientes();

    const PRIORIDAD: Record<string, number> = { vencido: 0, pendiente: 1, revision: 2 };
    const BADGE: Record<string, { label: string; cls: string; color: string }> = {
      vencido:  { label: 'Vencida',      cls: 'badge-red',    color: '#ef4444' },
      pendiente:{ label: 'Pendiente',    cls: 'badge-orange',  color: '#f59e0b' },
      revision: { label: 'En revisión',  cls: 'badge-gray',    color: '#6b7280' },
    };

    return this.todasSolicitudes()
      .filter(s => s.estado === 'vencido' || s.estado === 'pendiente' || s.estado === 'revision')
      .sort((a, b) => (PRIORIDAD[a.estado] ?? 9) - (PRIORIDAD[b.estado] ?? 9))
      .slice(0, 4)
      .map(s => {
        const empresa = clientes.find(e => asId(e._id) === asId(s.empresa_id));
        const centro  = centros.find(c => asId(c._id) === asId(s.centro_costo_id ?? ''));
        const subtitulo = [centro?.nombre, empresa?.razon_social].filter(Boolean).join(' · ');
        const b = BADGE[s.estado];
        return {
          id:         s._id,
          titulo:     s.nombre,
          subtitulo,
          badgeLabel: b.label,
          badgeClass: b.cls,
          iconBg:     b.color,
        };
      });
  });

  // ── Próximas actividades ────────────────────────────────────────────────
  protected readonly proximasActividades = computed((): ProximaActividad[] => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const centros = this.centrosService.centros();
    const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

    return this.actividadesService.actividades()
      .filter(a => this.parseFechaLocal(a.fecha) >= hoy)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, 5)
      .map(a => {
        const d      = this.parseFechaLocal(a.fecha);
        const centro = centros.find(c => asId(c._id) === asId(a.centro_costo_id));
        const lugar  = centro ? (centro.ubicacion_ciudad ? `${centro.nombre} ${centro.ubicacion_ciudad}` : centro.nombre) : '—';
        const color  = this.colorTipo(a);
        return {
          dia: d.getDate().toString(),
          mes: MESES[d.getMonth()],
          nombre: a.nombre,
          lugar,
          accentColor: color,
        };
      });
  });

  // ── Score SmartClarity ──────────────────────────────────────────────────
  protected readonly scoreEmpresas = computed((): ScoreEmpresa[] => {
    const sols = this.todasSolicitudes();
    return this.clientesService.clientes()
      .map(emp => {
        const empSols   = sols.filter(s => asId(s.empresa_id) === asId(emp._id));
        const aprobados = empSols.filter(s => s.estado === 'aprobado').length;
        return {
          nombre: emp.razon_social,
          score:  empSols.length > 0 ? Math.round(aprobados / empSols.length * 100) : 0,
          total:  empSols.length,
        };
      })
      .sort((a, b) => b.score - a.score);
  });

  protected scoreColor(score: number): string {
    if (score >= 75) return '#16a34a';
    if (score >= 50) return '#0095d6';
    return '#f59e0b';
  }

  // ── Últimas noticias ────────────────────────────────────────────────────
  protected readonly ultimasNoticias = computed((): Noticia[] =>
    [...this.noticiasService.noticias()]
      .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())
      .slice(0, 3)
  );

  protected noticiaColor(seccion: string): string {
    return SECCIONES.find(s => s.value === seccion)?.color ?? '#6b7280';
  }

  protected noticiaFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private badgeParaFecha(fechaStr: string): { label: string; cls: string } {
    const hoy   = new Date(); hoy.setHours(0, 0, 0, 0);
    const fecha = this.parseFechaLocal(fechaStr);
    const diff  = Math.round((fecha.getTime() - hoy.getTime()) / 86400000);
    if (diff === 0) return { label: 'Hoy',    cls: 'badge-gray' };
    if (diff === 1) return { label: 'Mañana', cls: 'badge-orange' };
    if (diff  < 0) return { label: 'Vencida', cls: 'badge-red' };
    const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return { label: `${fecha.getDate()} ${MESES[fecha.getMonth()]}`, cls: 'badge-green' };
  }

  private parseFechaLocal(iso: string): Date {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private colorTipo(a: Actividad): string {
    if (a.tipo_id && typeof a.tipo_id === 'object') {
      return (a.tipo_id as TipoActividad).color ?? '#0095d6';
    }
    return '#0095d6';
  }

  // ── Ciclo de vida ────────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      const clientes = this.clientesService.clientes();
      if (clientes.length > 0) {
        untracked(() => this.cargarSolicitudesGlobal(clientes.map(c => asId(c._id))));
      }
    });
  }

  ngOnInit(): void {
    this.clientesService.cargar();
    this.centrosService.cargar();
    this.proyectosService.cargar();
    this.usuariosService.cargar();
    this.actividadesService.cargar();
    this.noticiasService.cargar();
  }

  private cargarSolicitudesGlobal(clienteIds: string[]): void {
    if (this.loadingDocs()) return;
    this.loadingDocs.set(true);
    const reqs = clienteIds.map(id =>
      this.http.get<Solicitud[]>(this.api.url(`/empresas/${id}/solicitudes`))
        .pipe(catchError(() => of([] as Solicitud[])))
    );
    forkJoin(reqs).subscribe(resultados => {
      this.todasSolicitudes.set(resultados.flat());
      this.loadingDocs.set(false);
    });
  }
}
