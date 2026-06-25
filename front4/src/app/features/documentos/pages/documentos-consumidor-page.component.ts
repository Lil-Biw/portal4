import { Component, OnInit, inject, signal, computed, effect, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DocumentosService, DocTipo, CATEGORIAS_DOCUMENTO, DocumentoItem } from '../documentos.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { SolicitudesService, EstadoSolicitud, Solicitud } from '../../solicitudes/solicitudes.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { asId, detectarCategoriaDocumento } from '../../../shared/utils';

interface PanelState {
  showUpload: boolean;
  showFilter: boolean;
  nombreInput: string;
  categoriaInput: string;
  busqueda: string;
  categoriaFiltro: string;
  selectedFile: File | null;
}

@Component({
  selector: 'app-documentos-consumidor-page',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule, StatusBannerComponent],
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
  protected filtroEstado              = signal<EstadoSolicitud | ''>('');
  protected filtroTipoSolicitud       = signal('');
  protected busquedaEmpresa           = signal('');
  protected busquedaCentro            = signal('');
  protected busquedaProyecto          = signal('');
  protected mostrarBuscadorEmpresa    = signal(false);
  protected mostrarBuscadorCentro     = signal(false);
  protected mostrarBuscadorProyecto   = signal(false);
  protected tabConsumidorActiva       = signal<'documentacion' | 'solicitudes'>('documentacion');
  protected tabDocConsumidor          = signal<'activos' | 'vencidos'>('activos');
  protected tabJerarquia              = signal<'empresa' | 'centro' | 'proyecto'>('empresa');

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

  get empresaSeleccionadaObj() { return this.consumidorContext.empresaSeleccionada(); }

  get docTipoActual(): DocTipo {
    return this.tabJerarquia() === 'empresa' ? 'empresa'
      : this.tabJerarquia() === 'centro' ? 'centro'
      : 'proyecto';
  }

  get puedeGestionarDocumento(): boolean {
    return this.tabJerarquia() === 'empresa' ||
      (this.tabJerarquia() === 'centro'   && !!this.selectedCentroIdC()   && this.selectedCentroIdC()   !== 'todos') ||
      (this.tabJerarquia() === 'proyecto' && !!this.selectedProyectoIdC() && this.selectedProyectoIdC() !== 'todos');
  }

  get centroSeleccionado() {
    const id = this.selectedCentroIdC();
    if (!id || id === 'todos') return null;
    return this.centrosService.centros().find(c => c._id === id) ?? null;
  }

  get proyectoSeleccionado() {
    const id = this.selectedProyectoIdC();
    if (!id || id === 'todos') return null;
    return this.proyectosService.proyectos().find(p => p._id === id) ?? null;
  }

  formatFecha(fecha?: string): string {
    if (!fecha) return '—';
    const d = new Date(fecha);
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${meses[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  private filtrarSolicitudes(sols: Solicitud[], busqueda: string): Solicitud[] {
    const estado = this.filtroEstado();
    const tipo   = this.filtroTipoSolicitud();
    const term   = busqueda.trim().toLowerCase();
    if (estado) sols = sols.filter(s => s.estado === estado);
    if (tipo)   sols = sols.filter(s => s.tipo   === tipo);
    if (term)   sols = sols.filter(s => s.nombre.toLowerCase().includes(term));
    return sols;
  }

  protected solicitudesDeEmpresa = computed(() => {
    const sols = this.solicitudesService.solicitudes()
      .filter(s => !s.centro_costo_id && !s.proyecto_id && s.estado !== 'aprobado');
    return this.filtrarSolicitudes(sols, this.busquedaEmpresa());
  });

  protected solicitudesDeCentro = computed(() => {
    const centroId = this.selectedCentroIdC();
    if (!centroId) return [];
    const all = this.solicitudesService.solicitudes().filter(s => s.estado !== 'aprobado');
    const sols = centroId === 'todos'
      ? all.filter(s => s.centro_costo_id && !s.proyecto_id)
      : all.filter(s => s.centro_costo_id === centroId && !s.proyecto_id);
    return this.filtrarSolicitudes(sols, this.busquedaCentro());
  });

  protected solicitudesDeProyecto = computed(() => {
    const centroId   = this.selectedCentroIdC();
    const proyectoId = this.selectedProyectoIdC();
    if (!centroId || !proyectoId) return [];
    const all = this.solicitudesService.solicitudes().filter(s => s.estado !== 'aprobado');
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
    return this.filtrarSolicitudes(sols, this.busquedaProyecto());
  });

  protected haySolicitudesActivas = computed(() =>
    this.solicitudesService.solicitudes().some(s => s.estado !== 'aprobado')
  );

  // ─── lifecycle ────────────────────────────────────────────────────────────

  constructor() {
    effect(() => {
      const empresa = this.consumidorContext.empresaSeleccionada();
      this.selectedCentroIdC.set('');
      this.selectedProyectoIdC.set('');
      this.tabDocConsumidor.set('activos');
      this.service.documentosVencidos.set([]);
      if (empresa) {
        this.service.documentosCentro.set([]);
        this.service.documentosProyecto.set([]);
        this.service.documentosPorCentro.set([]);
        this.service.cargarEmpresa(empresa._id);
        this.solicitudesService.cargar(empresa._id);
        untracked(() => this.proyectosService.cargarPorEmpresa(empresa._id));
      } else {
        this.service.documentosEmpresa.set([]);
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
    const params = this.route.snapshot.queryParamMap;
    const tab        = params.get('tab') as 'documentacion' | 'solicitudes' | null;
    const centroId   = params.get('centroId');
    const proyectoId = params.get('proyectoId');
    if (tab) this.tabConsumidorActiva.set(tab);
    if (centroId) {
      this._pendingCentroId = centroId;
      this.tabJerarquia.set('centro');
    }
    if (proyectoId) {
      this._pendingProyectoId = proyectoId;
      this.tabJerarquia.set('proyecto');
    }
  }

  // ─── consumidor handlers ──────────────────────────────────────────────────

  onCentroChangeC(id: string): void {
    this.selectedCentroIdC.set(id);
    this.selectedProyectoIdC.set('');
    this.tabDocConsumidor.set('activos');
    this.service.documentosVencidos.set([]);
    const empresa = this.consumidorContext.empresaSeleccionada();
    const empresaId = empresa?._id ?? '';
    this.service.documentosPorProyecto.set([]);
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
    this.tabDocConsumidor.set('activos');
    this.service.documentosVencidos.set([]);
    this.selectedProyectoIdC.set(id);
    const empresa = this.consumidorContext.empresaSeleccionada();
    const empresaId = empresa?._id ?? '';
    const centroId = this.selectedCentroIdC();

    this.service.documentosProyecto.set([]);
    this.service.documentosPorProyecto.set([]);
    this.service.documentosPorCentro.set([]);

    if (id === 'todos' && centroId === 'todos') {
      const todosProyectos = this.proyectosService.proyectos().filter(
        p => asId(p.cliente_id) === asId(empresa?._id)
      );
      this.service.cargarTodosProyectos(empresaId, todosProyectos, this.centrosFiltradosC);
    } else if (id === 'todos' && centroId && centroId !== 'todos') {
      const proyectosDeCentro = this.proyectosService.proyectos().filter(
        p => asId(p.cliente_id) === asId(empresa?._id) && asId(p.centro_costo_id) === centroId
      );
      this.service.cargarTodosProyectos(empresaId, proyectosDeCentro, this.centrosFiltradosC);
    } else if (id && id !== 'todos' && centroId && centroId !== 'todos') {
      this.service.cargar('proyecto', empresaId, centroId, id);
    } else if (centroId && centroId !== 'todos') {
      this.service.cargar('centro', empresaId, centroId);
    } else {
      this.service.documentosCentro.set([]);
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
    if (!p.nombreInput) p.nombreInput = file.name;
    p.categoriaInput = detectarCategoriaDocumento(file.name)!;
  }

  onDrop(ev: DragEvent, tipo: DocTipo): void {
    ev.preventDefault();
    const file = ev.dataTransfer?.files?.[0];
    if (!file) return;
    const p = this.panels[tipo];
    p.selectedFile = file;
    if (!p.nombreInput) p.nombreInput = file.name;
    p.categoriaInput = detectarCategoriaDocumento(file.name)!;
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

  filteredDocsPorCentro() {
    const { busqueda, categoriaFiltro } = this.panels['centro'];
    const term = busqueda.trim().toLowerCase();
    return this.service.documentosPorCentro()
      .map(item => ({
        ...item,
        docs: item.docs
          .filter(d => !categoriaFiltro || d.categoria === categoriaFiltro)
          .filter(d => !term || d.nombre_display.toLowerCase().includes(term)),
      }))
      .filter(item => item.docs.length > 0);
  }

  filteredDocsPorProyecto() {
    const { busqueda, categoriaFiltro } = this.panels['proyecto'];
    const term = busqueda.trim().toLowerCase();
    return this.service.documentosPorProyecto()
      .map(item => ({
        ...item,
        docs: item.docs
          .filter(d => !categoriaFiltro || d.categoria === categoriaFiltro)
          .filter(d => !term || d.nombre_display.toLowerCase().includes(term)),
      }))
      .filter(item => item.docs.length > 0);
  }

  docsFiltrados(tipo: DocTipo): DocumentoItem[] {
    const docs = tipo === 'empresa' ? this.service.documentosEmpresa()
      : tipo === 'centro' ? this.service.documentosCentro()
      : this.service.documentosProyecto();
    const { busqueda, categoriaFiltro } = this.panels[tipo];
    const term = busqueda.trim().toLowerCase();
    return docs
      .filter(d => !categoriaFiltro || d.categoria === categoriaFiltro)
      .filter(d => !term || d.nombre_display.toLowerCase().includes(term));
  }

  eliminar(docUrl: string, tipo: DocTipo): void {
    const empresaId = asId(this.consumidorContext.empresaSeleccionada()?._id) ?? '';
    this.service.eliminar(docUrl, tipo, empresaId, this.selectedCentroIdC() || undefined, this.selectedProyectoIdC() || undefined);
  }

  // ─── helpers unificados para búsqueda de solicitudes ────────────────────

  toggleBuscadorSolicitudes(): void {
    if (this.tabJerarquia() === 'empresa') {
      this.mostrarBuscadorEmpresa.set(!this.mostrarBuscadorEmpresa());
    } else if (this.tabJerarquia() === 'centro') {
      this.mostrarBuscadorCentro.set(!this.mostrarBuscadorCentro());
    } else {
      this.mostrarBuscadorProyecto.set(!this.mostrarBuscadorProyecto());
    }
  }

  limpiarBuscadorSolicitudes(): void {
    if (this.tabJerarquia() === 'empresa') {
      this.busquedaEmpresa.set('');
      this.mostrarBuscadorEmpresa.set(false);
    } else if (this.tabJerarquia() === 'centro') {
      this.busquedaCentro.set('');
      this.mostrarBuscadorCentro.set(false);
    } else {
      this.busquedaProyecto.set('');
      this.mostrarBuscadorProyecto.set(false);
    }
    this.filtroTipoSolicitud.set('');
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

  activarTabVencidosConsumidor(): void {
    this.tabDocConsumidor.set('vencidos');
    this.cargarVencidosConsumidor();
  }

  cargarVencidosConsumidor(): void {
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) return;
    const centroId   = (this.selectedCentroIdC()   && this.selectedCentroIdC()   !== 'todos') ? this.selectedCentroIdC()   : undefined;
    const proyectoId = (this.selectedProyectoIdC() && this.selectedProyectoIdC() !== 'todos') ? this.selectedProyectoIdC() : undefined;
    this.service.cargarVencidos(empresa._id, centroId, proyectoId);
  }

  marcarVencidoConsumidor(docUrl: string): void {
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) return;
    const tipo       = this.docTipoActual;
    const centroId   = (this.selectedCentroIdC()   && this.selectedCentroIdC()   !== 'todos') ? this.selectedCentroIdC()   : undefined;
    const proyectoId = (this.selectedProyectoIdC() && this.selectedProyectoIdC() !== 'todos') ? this.selectedProyectoIdC() : undefined;
    this.service.marcarVencido(
      docUrl, tipo, empresa._id, centroId, proyectoId,
      this.empresaNombreC, this.centroNombreC, this.proyectoNombreC,
    );
  }

  // ─── private helpers ─────────────────────────────────────────────────────

  private emptyPanel(): PanelState {
    return { showUpload: false, showFilter: false, nombreInput: '', categoriaInput: 'Contratos', busqueda: '', categoriaFiltro: '', selectedFile: null };
  }
}
