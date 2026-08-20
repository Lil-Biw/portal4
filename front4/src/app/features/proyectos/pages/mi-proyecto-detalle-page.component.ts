import { Component, OnInit, OnDestroy, inject, computed, effect, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { ProyectosService } from '../proyectos.service';
import { CentrosService } from '../../centros/centros.service';
import { SolicitudesService } from '../../solicitudes/solicitudes.service';
import { DocumentosService } from '../../documentos/documentos.service';
import { StatChipComponent, ChipVariant } from '../../../shared/components/stat-chip/stat-chip.component';
import { DonutArcComponent } from '../../../shared/components/donut-arc/donut-arc.component';
import { asId, calcularScoreDocumental, scoreChipVariantFn, scoreChipLabelFn, colorEstadoSolicitud } from '../../../shared/utils';
import { EstadoProyecto, ESTADO_PROYECTO_LABEL } from '../../../shared/models/proyecto.model';

@Component({
  selector: 'app-mi-proyecto-detalle-page',
  standalone: true,
  imports: [StatChipComponent, DonutArcComponent],
  templateUrl: './mi-proyecto-detalle-page.component.html',
  styles: [`
    .cards-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem; }
    @media (max-width: 720px) { .cards-grid { grid-template-columns:1fr; } }
    .section-title { margin:0 0 .75rem; font-size:.95rem; font-weight:700; color:var(--fg-2); }
    .dl-row { display:flex; gap:.5rem; margin-bottom:.45rem; }
    .dl-label { font-size:.78rem; color:var(--fg-4); min-width:90px; flex-shrink:0; }
    .dl-value { font-size:.82rem; color:var(--fg-2); font-weight:500; }
    .doc-row { display:flex; align-items:center; justify-content:space-between; padding:.55rem .75rem; border-radius:8px; border:1px solid var(--border-subtle); margin-bottom:.4rem; font-size:.82rem; }
    .sol-row  { display:flex; align-items:center; justify-content:space-between; padding:.55rem .75rem; border-radius:8px; border:1px solid var(--border-subtle); margin-bottom:.4rem; font-size:.82rem; }
  `],
})
export class MiProyectoDetallePageComponent implements OnInit, OnDestroy {
  private readonly route              = inject(ActivatedRoute);
  private readonly router             = inject(Router);
  private readonly consumidorContext  = inject(ConsumidorContextService);
  private readonly proyectosService   = inject(ProyectosService);
  private readonly centrosService     = inject(CentrosService);
  private readonly solicitudesService = inject(SolicitudesService);
  protected readonly documentosService  = inject(DocumentosService);

  protected proyecto = computed(() =>
    this.consumidorContext.proyectoSeleccionado() ?? this.proyectosService.seleccionado()
  );

  protected empresa = computed(() => this.consumidorContext.empresaSeleccionada());

  protected centros = computed(() => {
    const p = this.proyecto();
    if (!p) return [];
    const ids = (p.centro_costo_ids ?? []).map(asId);
    return this.centrosService.centros().filter(c => ids.includes(asId(c._id)));
  });

  protected centrosNombres = computed(() => this.centros().map(c => c.nombre).join(', '));

  protected scoreDoc = computed(() => {
    const p = this.proyecto();
    const sols = this.solicitudesService.solicitudes().filter(s =>
      p ? asId(s.proyecto_id) === asId(p._id) : false
    );
    const docsActivos  = this.documentosService.documentosProyecto().length;
    const docsVencidos = this.documentosService.documentosVencidos().length;
    return calcularScoreDocumental(sols, docsActivos, docsVencidos);
  });

  protected scoreChipVariant = computed((): ChipVariant => scoreChipVariantFn(this.scoreDoc().pct));

  protected scoreChipLabel = computed((): string => scoreChipLabelFn(this.scoreDoc().pct));

  protected solicitudesProyecto = computed(() => {
    const p = this.proyecto();
    if (!p) return [];
    return this.solicitudesService.solicitudes().filter(s => asId(s.proyecto_id) === asId(p._id));
  });

  constructor() {
    effect(() => {
      const p   = this.proyecto();
      const emp = this.empresa();
      const c   = this.centros()[0];
      if (!p || !emp) return;
      untracked(() => {
        this.documentosService.cargar('proyecto', emp._id, c?._id, p._id);
        this.documentosService.cargarVencidos(emp._id, c?._id, asId(p._id));
      });
    });
  }

  private static readonly ESTADO_BADGE_STYLE: Record<string, string> = {
    estancado:            'background:var(--danger-bg);color:var(--danger)',
    nuevo_sin_oc:         'background:rgba(107,114,128,.12);color:var(--fg-4)',
    nuevo_con_oc:         'background:rgba(100,116,139,.12);color:var(--fg-3)',
    en_ejecucion:         'background:var(--ok-bg);color:var(--ok)',
    cierre_pendiente:     'background:rgba(124,58,237,.12);color:#7c3aed',
    finalizado_facturar:  'background:var(--warn-bg);color:var(--warn)',
    finalizado_facturado: 'background:rgba(13,148,136,.12);color:#0d9488',
  };

  protected estadoBadgeStyle(estado: string): string {
    return MiProyectoDetallePageComponent.ESTADO_BADGE_STYLE[estado]
      ?? 'background:var(--border-subtle);color:var(--fg-4)';
  }

  protected estadoLabel(estado: string): string {
    return ESTADO_PROYECTO_LABEL[estado as EstadoProyecto] ?? estado;
  }

  protected estadoSolStyle(estado: string): string {
    if (estado === 'aprobado')  return 'background:var(--ok-bg);color:var(--ok)';
    if (estado === 'revision')  return 'background:var(--warn-bg);color:var(--warn)';
    if (estado === 'rechazado') return 'background:var(--danger-bg);color:var(--danger)';
    return 'background:var(--border-subtle);color:var(--fg-4)';
  }

  protected formatFecha(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  protected descargarDoc(url: string, nombreDisplay?: string): void {
    this.documentosService.descargar(url, nombreDisplay);
  }

  docTipoInfo(mime: string): { color: string; tipo: 'pdf' | 'doc' | 'xls' | 'zip' | 'img' | 'file' } {
    if (!mime) return { color: '#6b7280', tipo: 'file' };
    if (mime.includes('pdf'))                                return { color: '#ef4444', tipo: 'pdf' };
    if (mime.includes('word') || mime.includes('.document')) return { color: '#3b82f6', tipo: 'doc' };
    if (mime.includes('excel') || mime.includes('.sheet'))   return { color: '#22c55e', tipo: 'xls' };
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar')) return { color: '#8b5cf6', tipo: 'zip' };
    if (mime.startsWith('image/'))                           return { color: '#f59e0b', tipo: 'img' };
    return { color: '#6b7280', tipo: 'file' };
  }

  protected readonly dotColorSolicitud = colorEstadoSolicitud;

  protected irADocumentos(tab: 'documentacion' | 'solicitudes'): void {
    const c = this.centros()[0];
    const p = this.proyecto();
    this.router.navigate(['/documentos'], {
      queryParams: {
        tab,
        ...(c ? { centroId: asId(c._id) } : {}),
        ...(p ? { proyectoId: asId(p._id) } : {}),
      },
    });
  }

  volver(): void {
    this.consumidorContext.seleccionarProyecto(null);
    this.router.navigate(['/mis-proyectos']);
  }

  ngOnInit(): void {
    const id  = this.route.snapshot.paramMap.get('id')!;
    const emp = this.empresa();
    if (!this.consumidorContext.proyectoSeleccionado()) {
      this.proyectosService.cargarUno(id);
    }
    if (emp) {
      this.solicitudesService.cargar(emp._id, undefined, id);
    }
    // documentosService.cargar() se ejecuta en el effect del constructor
  }

  ngOnDestroy(): void {
    this.consumidorContext.seleccionarProyecto(null);
  }
}
