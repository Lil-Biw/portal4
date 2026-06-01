import { Component, OnInit, inject, signal, computed, effect, untracked } from '@angular/core';
import { NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DocumentosService, DocTipo, CATEGORIAS_DOCUMENTO, DocumentoItem } from '../documentos.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { SolicitudesService, EstadoSolicitud, Solicitud } from '../../solicitudes/solicitudes.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { asId } from '../../../shared/utils';

interface PanelState {
  showUpload: boolean;
  showFilter: boolean;
  nombreInput: string;
  categoriaInput: string;
  filtrosCategorias: string[];
  selectedFile: File | null;
}

@Component({
  selector: 'app-documentos-consumidor-page',
  standalone: true,
  imports: [NgFor, NgIf, NgTemplateOutlet, FormsModule, StatusBannerComponent],
  templateUrl: './documentos-consumidor-page.component.html',
})
export class DocumentosConsumidorPageComponent implements OnInit {
  protected readonly service            = inject(DocumentosService);
  protected readonly centrosService     = inject(CentrosService);
  protected readonly proyectosService   = inject(ProyectosService);
  protected readonly consumidorContext  = inject(ConsumidorContextService);
  protected readonly solicitudesService = inject(SolicitudesService);
  private  readonly route               = inject(ActivatedRoute);

  private _pendingCentroId:   string | null = null;
  private _pendingProyectoId: string | null = null;

  protected readonly categorias = CATEGORIAS_DOCUMENTO;

  protected selectedCentroIdC   = signal('');
  protected selectedProyectoIdC = signal('');
  protected filtroEstado        = signal<EstadoSolicitud | ''>('');
  protected tabConsumidorActiva = signal<'documentacion' | 'solicitudes'>('documentacion');

  protected solicitudAdjuntando = signal<string | null>(null);
  protected adjuntoFile: File | null = null;

  protected panels: Record<DocTipo, PanelState> = {
    empresa:  this.emptyPanel(),
    centro:   this.emptyPanel(),
    proyecto: this.emptyPanel(),
  };

  // ─── computed ─────────────────────────────────────────────────────────────

  private readonly centrosFiltradosCSig = computed(() => {
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === asId(empresa._id));
  });

  get centrosFiltradosC() {
    return this.centrosFiltradosCSig();
  }

  get proyectosFiltradosC() {
    const empresa = this.consumidorContext.empresaSeleccionada();
    const centroId = this.selectedCentroIdC();
    if (!empresa || !centroId || centroId === 'todos') return [];
    return this.proyectosService.proyectos().filter(p =>
      asId(p.cliente_id) === asId(empresa._id) && asId(p.centro_costo_id) === centroId
    );
  }

  get empresaNombreC()  { return this.consumidorContext.empresaSeleccionada()?.razon_social; }
  get centroNombreC()   { return this.centrosService.centros().find(c => c._id === this.selectedCentroIdC())?.nombre; }
  get proyectoNombreC() { return this.proyectosService.proyectos().find(p => p._id === this.selectedProyectoIdC())?.nombre; }

  protected solicitudesDeEmpresa = computed(() => {
    const estado = this.filtroEstado();
    const sols = this.solicitudesService.solicitudes()
      .filter(s => !s.centro_costo_id && !s.proyecto_id);
    return estado ? sols.filter(s => s.estado === estado) : sols;
  });

  protected solicitudesDeCentro = computed(() => {
    const centroId = this.selectedCentroIdC();
    if (!centroId) return [];
    const estado = this.filtroEstado();
    const all = this.solicitudesService.solicitudes();
    const sols = centroId === 'todos'
      ? all.filter(s => s.centro_costo_id && !s.proyecto_id)
      : all.filter(s => s.centro_costo_id === centroId && !s.proyecto_id);
    return estado ? sols.filter(s => s.estado === estado) : sols;
  });

  protected solicitudesDeProyecto = computed(() => {
    const centroId  = this.selectedCentroIdC();
    const proyectoId = this.selectedProyectoIdC();
    if (!centroId || !proyectoId) return [];
    const estado = this.filtroEstado();
    const all = this.solicitudesService.solicitudes();
    let sols: Solicitud[];
    if (proyectoId === 'todos') {
      if (centroId === 'todos') {
        sols = all.filter(s => !!s.proyecto_id);
      } else {
        const ids = this.proyectosService.proyectos()
          .filter(p => asId(p.centro_costo_id) === centroId)
          .map(p => asId(p._id));
        sols = all.filter(s => s.proyecto_id && ids.includes(s.proyecto_id));
      }
    } else {
      sols = all.filter(s => s.proyecto_id === proyectoId);
    }
    return estado ? sols.filter(s => s.estado === estado) : sols;
  });

  // ─── lifecycle ────────────────────────────────────────────────────────────

  constructor() {
    effect(() => {
      const empresa = this.consumidorContext.empresaSeleccionada();
      this.selectedCentroIdC.set('');
      this.selectedProyectoIdC.set('');
      if (empresa) {
        this.service.documentosEmpresa.set([]);
        this.service.documentosCentro.set([]);
        this.service.documentosProyecto.set([]);
        this.service.documentosPorCentro.set([]);
        this.solicitudesService.cargar(empresa._id);
      } else {
        this.solicitudesService.cargar('');
      }
    });

    effect(() => {
      const centros = this.centrosFiltradosCSig();
      if (!this._pendingCentroId || centros.length === 0) return;
      const centroId   = this._pendingCentroId;
      const proyectoId = this._pendingProyectoId;
      this._pendingCentroId   = null;
      this._pendingProyectoId = null;
      untracked(() => {
        this.onCentroChangeC(centroId);
        if (proyectoId) this.onProyectoChangeC(proyectoId);
      });
    });
  }

  ngOnInit(): void {
    this.centrosService.cargar();
    this.proyectosService.cargar();

    const params = this.route.snapshot.queryParamMap;
    const tab        = params.get('tab') as 'documentacion' | 'solicitudes' | null;
    const centroId   = params.get('centroId');
    const proyectoId = params.get('proyectoId');
    if (tab) this.tabConsumidorActiva.set(tab);
    if (centroId)   this._pendingCentroId   = centroId;
    if (proyectoId) this._pendingProyectoId = proyectoId;
  }

  // ─── consumidor handlers ──────────────────────────────────────────────────

  onCentroChangeC(id: string): void {
    this.selectedCentroIdC.set(id);
    this.selectedProyectoIdC.set('');
    const empresa = this.consumidorContext.empresaSeleccionada();
    const empresaId = empresa?._id ?? '';
    if (id === 'todos') {
      this.service.documentosCentro.set([]);
      this.service.cargarTodosCentros(empresaId, this.centrosFiltradosC);
    } else if (id) {
      this.service.documentosPorCentro.set([]);
      this.service.cargar('centro', empresaId, id);
    } else {
      this.service.documentosPorCentro.set([]);
      this.service.documentosCentro.set([]);
    }
    if (empresa) this.solicitudesService.cargar(empresa._id);
  }

  onProyectoChangeC(id: string): void {
    this.selectedProyectoIdC.set(id);
    const empresa = this.consumidorContext.empresaSeleccionada();
    const empresaId = empresa?._id ?? '';
    const centroId = this.selectedCentroIdC();
    if (id && id !== 'todos' && centroId && centroId !== 'todos') {
      this.service.cargar('proyecto', empresaId, centroId, id);
    } else if (centroId && centroId !== 'todos') {
      this.service.cargar('centro', empresaId, centroId);
    } else {
      this.service.documentosCentro.set([]);
      this.service.documentosProyecto.set([]);
    }
    if (empresa) this.solicitudesService.cargar(empresa._id);
  }

  // ─── upload panels ────────────────────────────────────────────────────────

  toggleUpload(tipo: DocTipo): void {
    const p = this.panels[tipo];
    p.showUpload = !p.showUpload;
    if (p.showUpload) p.showFilter = false;
    if (!p.showUpload) { p.selectedFile = null; p.nombreInput = ''; }
  }

  toggleFilter(tipo: DocTipo): void {
    const p = this.panels[tipo];
    p.showFilter = !p.showFilter;
    if (p.showFilter) p.showUpload = false;
  }

  onFileSelected(ev: Event, tipo: DocTipo): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const p = this.panels[tipo];
    p.selectedFile = file;
    if (!p.nombreInput) p.nombreInput = file.name.replace(/\.[^/.]+$/, '');
  }

  confirmarSubida(tipo: DocTipo): void {
    const p = this.panels[tipo];
    if (!p.selectedFile) return;
    const empresaId = this.consumidorContext.empresaSeleccionada()?._id ?? '';
    this.service.subir(
      p.selectedFile, tipo,
      empresaId,
      this.selectedCentroIdC() || undefined,
      this.selectedProyectoIdC() || undefined,
      p.nombreInput || undefined,
      p.categoriaInput || undefined,
    );
    p.selectedFile = null;
    p.nombreInput = '';
    p.showUpload = false;
  }

  toggleFiltroCategoria(tipo: DocTipo, cat: string): void {
    const filtros = this.panels[tipo].filtrosCategorias;
    const idx = filtros.indexOf(cat);
    if (idx === -1) filtros.push(cat);
    else filtros.splice(idx, 1);
  }

  isFiltroSelected(tipo: DocTipo, cat: string): boolean {
    return this.panels[tipo].filtrosCategorias.includes(cat);
  }

  docsFiltrados(tipo: DocTipo): DocumentoItem[] {
    return tipo === 'empresa' ? this.service.documentosEmpresa()
      : tipo === 'centro' ? this.service.documentosCentro()
      : this.service.documentosProyecto();
  }

  eliminar(docId: string, tipo: DocTipo): void {
    const empresaId = this.consumidorContext.empresaSeleccionada()?._id ?? '';
    this.service.eliminar(
      docId, tipo,
      empresaId,
      this.selectedCentroIdC() || undefined,
      this.selectedProyectoIdC() || undefined,
    );
  }

  // ─── solicitudes (consumidor) ─────────────────────────────────────────────

  abrirAdjuntar(id: string): void {
    this.solicitudAdjuntando.set(id);
    this.adjuntoFile = null;
    this.solicitudesService.clearStatus();
  }

  onAdjuntoSelected(ev: Event): void {
    this.adjuntoFile = (ev.target as HTMLInputElement).files?.[0] ?? null;
  }

  confirmarAdjunto(): void {
    const id = this.solicitudAdjuntando();
    if (!id || !this.adjuntoFile) return;
    const file = this.adjuntoFile;
    this.adjuntoFile = null;
    this.solicitudesService.adjuntar(id, file, () => {
      this.solicitudAdjuntando.set(null);
    });
  }

  estadoChipStyle(estado: EstadoSolicitud): { color: string; bg: string } {
    const map: Record<EstadoSolicitud, { color: string; bg: string }> = {
      pendiente: { color: '#92400e', bg: '#fef3c7' },
      revision:  { color: '#1e40af', bg: '#dbeafe' },
      aprobado:  { color: '#14532d', bg: '#dcfce7' },
      rechazado: { color: '#7f1d1d', bg: '#fee2e2' },
      vencido:   { color: '#374151', bg: '#f3f4f6' },
    };
    return map[estado];
  }

  estadoLabel(estado: EstadoSolicitud): string {
    const map: Record<EstadoSolicitud, string> = {
      pendiente: 'Pendiente',
      revision:  'En revisión',
      aprobado:  'Aprobado',
      rechazado: 'Rechazado',
      vencido:   'Vencido',
    };
    return map[estado];
  }

  // ─── private helpers ─────────────────────────────────────────────────────

  private emptyPanel(): PanelState {
    return { showUpload: false, showFilter: false, nombreInput: '', categoriaInput: 'Contratos', filtrosCategorias: [], selectedFile: null };
  }
}
