import { Component, OnInit, OnDestroy, inject, computed, signal, effect, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CentrosService } from '../centros.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { SolicitudesService } from '../../solicitudes/solicitudes.service';
import { DocumentosService } from '../../documentos/documentos.service';
import { ActivosService } from '../../activos/activos.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { AuthService } from '../../auth/auth.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { CentroFormComponent } from '../components/centro-form/centro-form.component';
import { SpiderChartComponent } from '../../../shared/components/spider-chart/spider-chart.component';
import { StatChipComponent, ChipVariant } from '../../../shared/components/stat-chip/stat-chip.component';
import { DonutArcComponent } from '../../../shared/components/donut-arc/donut-arc.component';
import { ActivoIconoComponent } from '../../activos/components/activo-icono/activo-icono.component';
import { CreateCentroDto } from '../../../shared/models/centro.model';
import { CentroCosto } from '../../../shared/models/centro.model';
import { Activo, TipoActivo } from '../../../shared/models/activo.model';
import { Proyecto, EstadoProyecto, ESTADO_PROYECTO_LABEL } from '../../../shared/models/proyecto.model';
import { asId, confirmarEliminacion, calcularScoreDocumental, scoreChipVariantFn, scoreChipLabelFn, colorEstadoSolicitud, estadoStyleFn } from '../../../shared/utils';
import { ApiService } from '../../../core/services/api.service';

type CentroModal = 'crear' | 'editar' | null;

@Component({
  selector: 'app-mis-centros-page',
  standalone: true,
  imports: [FormsModule, SpiderChartComponent, StatChipComponent, DonutArcComponent, ActivoIconoComponent, StatusBannerComponent, CentroFormComponent],
  templateUrl: './mis-centros-page.component.html',
  styles: [`
    .centro-card {
      cursor: pointer;
      transition: box-shadow .15s, border-color .15s;
      border: 1px solid var(--border-default);
    }
    .centro-card:hover {
      box-shadow: 0 4px 16px rgba(0,174,239,.18);
      border-color: var(--sc-cyan);
    }

    .btn-icon-sq {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 1px solid var(--border-default);
      border-radius: 7px;
      background: none;
      cursor: pointer;
      color: var(--fg-4);
      transition: border-color .15s, color .15s, background .15s;
    }
    .btn-icon-sq:hover { border-color: var(--sc-cyan); color: var(--sc-cyan); background: var(--sc-cyan-tint-6); }
    .btn-action-danger { color: var(--danger); }
    .btn-action-danger:hover { color: var(--danger); background: var(--danger-bg); }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
    }
    .header-actions { display: flex; gap: .6rem; align-items: center; }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: var(--overlay);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1rem;
    }
    .modal {
      background: var(--bg-0);
      border-radius: 16px;
      box-shadow: var(--shadow-4);
      width: 100%;
      max-width: 640px;
      max-height: 85vh;
      overflow-y: auto;
      padding: 1.5rem;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .modal-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .modal-close {
      background: none;
      border: none;
      font-size: 1.4rem;
      line-height: 1;
      cursor: pointer;
      color: var(--fg-4);
      padding: 0 .25rem;
    }
    .modal-close:hover { color: var(--fg-2); }
  `],
})
export class MisCentrosPageComponent implements OnInit, OnDestroy {
  private  readonly consumidorContext  = inject(ConsumidorContextService);
  private  readonly router             = inject(Router);
  protected readonly service           = inject(CentrosService);
  protected readonly solicitudesService = inject(SolicitudesService);
  protected readonly documentosService  = inject(DocumentosService);
  protected readonly activosService     = inject(ActivosService);
  protected readonly proyectosService    = inject(ProyectosService);
  protected readonly authService        = inject(AuthService);
  private  readonly sanitizer          = inject(DomSanitizer);
  private  readonly api                = inject(ApiService);

  protected modal            = signal<CentroModal>(null);
  protected pendingFoto      = signal<File | null>(null);

  get empresa()        { return this.consumidorContext.empresaSeleccionada(); }
  get centroActivo()   { return this.consumidorContext.centroSeleccionado(); }

  protected centros = computed(() => {
    const emp = this.consumidorContext.empresaSeleccionada();
    if (!emp) return [];
    return this.service.centros().filter(c => asId(c.cliente_id) === asId(emp._id));
  });

  protected mostrarBuscar = signal(false);
  protected busqueda       = signal('');

  protected centrosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.centros();
    return this.centros().filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      c.codigo.toLowerCase().includes(q) ||
      (c.ubicacion_ciudad ?? '').toLowerCase().includes(q) ||
      (c.ubicacion_region ?? '').toLowerCase().includes(q)
    );
  });

  toggleBuscar(): void {
    this.mostrarBuscar.update(v => !v);
    if (!this.mostrarBuscar()) this.busqueda.set('');
  }

  // ── Spider chart ────────────────────────────────────────────────────────
  readonly spiderLabels = [
    'RRHH y\ndocumentación',
    'Normativa',
    'Suministro',
    'Seguridad\nOperacional',
    'Continuidad\nOperacional',
  ];

  protected spiderValues = computed<number[]>(() => {
    const centroId = asId(this.consumidorContext.centroSeleccionado()?._id);
    if (!centroId) return [50, 50, 50, 50, 50];
    const centro = this.service.centros().find(c => asId(c._id) === centroId) ?? this.consumidorContext.centroSeleccionado();
    const raw = centro?.score_smartclarity;
    if (raw && raw.length === 5) return raw.map(v => v * 10);
    return [50, 50, 50, 50, 50];
  });

  // ── Score documental del centro ─────────────────────────────────────────
  protected scoreDelCentro = computed(() => {
    const centro = this.consumidorContext.centroSeleccionado();
    if (!centro) return calcularScoreDocumental([]);
    const sols = this.solicitudesService.solicitudes()
      .filter(s => asId(s.centro_costo_id) === asId(centro._id));
    const docsActivos  = this.documentosService.documentosCentro().length;
    const docsVencidos = this.documentosService.documentosVencidos().length;
    return calcularScoreDocumental(sols, docsActivos, docsVencidos);
  });

  protected solicitudesDelCentro = computed(() => {
    const centro = this.consumidorContext.centroSeleccionado();
    if (!centro) return [];
    return this.solicitudesService.solicitudes()
      .filter(s => asId(s.centro_costo_id) === asId(centro._id) && !s.proyecto_id);
  });

  scoreDeCentro(centroId: string) {
    const sols = this.solicitudesService.solicitudes()
      .filter(s => s.centro_costo_id === centroId);
    const grupo = this.documentosService.documentosPorCentro()
      .find(g => g.centroId === centroId);
    const docsActivos = grupo?.docs.length ?? 0;
    return calcularScoreDocumental(sols, docsActivos, 0);
  }

  protected fotoUrlCentro(centro: CentroCosto | null): string | null {
    if (!centro?._id || !centro?.foto?.tipo_mime) return null;
    return this.api.url(`/empresas/${asId(centro.cliente_id)}/centros/${asId(centro._id)}/foto`);
  }

  protected readonly estadoStyle = estadoStyleFn;

  protected scoreChipVariant = computed((): ChipVariant => scoreChipVariantFn(this.scoreDelCentro().pct));

  protected scoreChipLabel = computed((): string => scoreChipLabelFn(this.scoreDelCentro().pct));

  // ── Map URL ─────────────────────────────────────────────────────────────
  protected mapUrl = computed((): SafeResourceUrl => {
    const c = this.consumidorContext.centroSeleccionado();
    if (!c) return '';
    let q: string;
    if (c.ubicacion_latitud != null && c.ubicacion_longitud != null) {
      q = `${c.ubicacion_latitud},${c.ubicacion_longitud}`;
    } else {
      const parts = [c.ubicacion_direccion, c.ubicacion_ciudad, c.ubicacion_region, c.ubicacion_pais]
        .filter(Boolean).join(', ');
      q = encodeURIComponent(parts || c.nombre);
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://maps.google.com/maps?q=${q}&output=embed&z=14`
    );
  });

  constructor() {
    effect(() => {
      const emp     = this.consumidorContext.empresaSeleccionada();
      const centros = this.centros();
      if (!emp || !centros.length) return;
      untracked(() => this.documentosService.cargarTodosCentros(emp._id, centros));
    });
    effect(() => {
      if (this.service.status()?.type === 'ok' && this.modal() !== null) {
        this.cerrarModal();
      }
    });
  }

  ngOnInit(): void {
    const emp = this.empresa;
    if (emp) {
      this.service.cargarPorEmpresa(emp._id);
      this.solicitudesService.cargar(emp._id);
    }
  }

  // Limpia el centro al salir de esta página
  ngOnDestroy(): void {
    this.consumidorContext.seleccionarCentro(null);
  }

  seleccionarCentro(centro: CentroCosto): void {
    this.consumidorContext.seleccionarCentro(centro);
    const emp = this.empresa;
    if (emp) {
      this.documentosService.cargar('centro', emp._id, asId(centro._id));
      this.documentosService.cargarVencidos(emp._id, asId(centro._id));
      this.activosService.cargarParaConsumidor(emp._id, asId(centro._id));
      this.proyectosService.cargarParaConsumidor(emp._id, asId(centro._id));
    }
  }

  irAProyecto(proyecto: Proyecto): void {
    this.consumidorContext.seleccionarProyecto(proyecto);
    this.router.navigate(['/mis-proyectos', proyecto._id]);
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
    return MisCentrosPageComponent.ESTADO_BADGE_STYLE[estado]
      ?? 'background:rgba(107,114,128,.1);color:var(--fg-4)';
  }

  protected estadoLabel(estado: string): string {
    return ESTADO_PROYECTO_LABEL[estado as EstadoProyecto] ?? estado;
  }

  irADocumentos(tab: 'documentacion' | 'solicitudes'): void {
    const c = this.centroActivo;
    this.router.navigate(['/documentos'], {
      queryParams: { tab, ...(c ? { centroId: asId(c._id) } : {}) },
    });
  }

  volver(): void {
    this.consumidorContext.seleccionarCentro(null);
  }

  // ── Modal crear/editar ───────────────────────────────────────────────────
  abrirCrear(): void {
    const emp = this.empresa;
    if (!emp) return;
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.pendingFoto.set(null);
    this.modal.set('crear');
  }

  abrirEditar(centro: CentroCosto): void {
    this.service.seleccionar(centro);
    this.pendingFoto.set(null);
    this.service.clearStatus();
    this.modal.set('editar');
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.pendingFoto.set(null);
  }

  crear(dto: CreateCentroDto): void {
    this.service.crear(dto, this.pendingFoto());
    this.pendingFoto.set(null);
  }

  actualizar(dto: CreateCentroDto): void {
    const id = this.service.seleccionado()?._id;
    if (id) this.service.actualizar(id, dto, this.pendingFoto());
    this.pendingFoto.set(null);
  }

  eliminarCentro(centro: CentroCosto): void {
    if (!confirmarEliminacion(centro.nombre)) return;
    this.service.seleccionar(centro);
    this.service.eliminar(centro._id);
  }

  tipoActivoNombre(a: Activo): string {
    if (typeof a.tipo_activo_id === 'object') return (a.tipo_activo_id as TipoActivo).nombre;
    return '';
  }

  tipoActivoColor(a: Activo): string {
    if (typeof a.tipo_activo_id === 'object') return (a.tipo_activo_id as TipoActivo).color ?? '#00AEEF';
    return '#00AEEF';
  }

  tipoActivoIcono(a: Activo): string | undefined {
    if (typeof a.tipo_activo_id === 'object') return (a.tipo_activo_id as TipoActivo).icono;
    return undefined;
  }

  protected mapsLink = computed((): string => {
    const c = this.consumidorContext.centroSeleccionado();
    if (!c) return '#';
    if (c.ubicacion_latitud != null && c.ubicacion_longitud != null) {
      return `https://www.google.com/maps?q=${c.ubicacion_latitud},${c.ubicacion_longitud}`;
    }
    const parts = [c.ubicacion_direccion, c.ubicacion_ciudad, c.ubicacion_region, c.ubicacion_pais]
      .filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/${encodeURIComponent(parts || c.nombre)}`;
  });

  docTipoInfo(mime: string): { color: string; tipo: 'pdf' | 'doc' | 'xls' | 'zip' | 'img' | 'file' } {
    if (!mime) return { color: '#6b7280', tipo: 'file' };
    if (mime.includes('pdf'))                           return { color: '#ef4444', tipo: 'pdf' };
    if (mime.includes('word') || mime.includes('.document')) return { color: '#3b82f6', tipo: 'doc' };
    if (mime.includes('excel') || mime.includes('.sheet'))   return { color: '#22c55e', tipo: 'xls' };
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar')) return { color: '#8b5cf6', tipo: 'zip' };
    if (mime.startsWith('image/'))                      return { color: '#f59e0b', tipo: 'img' };
    return { color: '#6b7280', tipo: 'file' };
  }

  protected readonly dotColorSolicitud = colorEstadoSolicitud;
}
