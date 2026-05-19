import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentosService, DocTipo, CATEGORIAS_DOCUMENTO, DocumentoItem } from '../documentos.service';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { ProfileService } from '../../../profile/profile.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { SolicitudesService, CreateSolicitudDto, UpdateSolicitudDto, EstadoSolicitud, Solicitud } from '../../solicitudes/solicitudes.service';
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

export interface EstadoDestino {
  valor: EstadoSolicitud;
  label: string;
  colorBg: string;
  colorText: string;
}

@Component({
  selector: 'app-documentos-page',
  standalone: true,
  imports: [NgFor, NgIf, NgTemplateOutlet, FormsModule, StatusBannerComponent],
  templateUrl: './documentos-page.component.html',
})
export class DocumentosPageComponent implements OnInit {
  protected readonly service             = inject(DocumentosService);
  protected readonly clientesService     = inject(ClientesService);
  protected readonly centrosService      = inject(CentrosService);
  protected readonly proyectosService    = inject(ProyectosService);
  protected readonly profileService      = inject(ProfileService);
  protected readonly consumidorContext   = inject(ConsumidorContextService);
  protected readonly solicitudesService  = inject(SolicitudesService);

  protected readonly categorias = CATEGORIAS_DOCUMENTO;

  // Admin context selectors
  protected selectedEmpresaId  = '';
  protected selectedCentroId   = '';
  protected selectedProyectoId = '';

  // Consumidor context selectors — signals para reactividad en computed()
  protected selectedCentroIdC   = signal('');
  protected selectedProyectoIdC = signal('');

  // Filtro de estado solicitudes — signal para reactividad en computed()
  protected filtroEstado = signal<EstadoSolicitud | ''>('');

  // Pestañas admin y consumidor
  protected tabAdminActiva       = signal<'documentacion' | 'solicitudes'>('documentacion');
  protected tabConsumidorActiva  = signal<'documentacion' | 'solicitudes'>('documentacion');

  // Admin: nueva solicitud
  protected showSolicitudForm = signal(false);
  protected solicitudForm: CreateSolicitudDto = this.emptySolicitudForm();

  // Admin: cambio de estado inline
  protected solicitudEstadoEdit = signal<string | null>(null);

  // Admin: edición inline de solicitud
  protected solicitudEditando = signal<string | null>(null);
  protected solicitudEditForm: UpdateSolicitudDto = {};

  // Adjuntar archivo a solicitud (consumidor)
  protected solicitudAdjuntando = signal<string | null>(null);
  protected adjuntoFile: File | null = null;

  protected panels: Record<DocTipo, PanelState> = {
    empresa:  this.emptyPanel(),
    centro:   this.emptyPanel(),
    proyecto: this.emptyPanel(),
  };

  // ─── computed ─────────────────────────────────────────────────────────────

  protected mode = computed(() => this.profileService.mode());

  // Admin
  get centrosFiltrados() {
    if (!this.selectedEmpresaId) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === this.selectedEmpresaId);
  }

  get proyectosFiltrados() {
    // Cuando Centro=Todos solo aplica Ninguno/Todos en proyecto, no proyectos individuales
    if (!this.selectedEmpresaId || !this.selectedCentroId || this.selectedCentroId === 'todos') return [];
    return this.proyectosService.proyectos().filter(p =>
      asId(p.cliente_id) === this.selectedEmpresaId && asId(p.centro_costo_id) === this.selectedCentroId
    );
  }

  // Consumidor
  get centrosFiltradosC() {
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === asId(empresa._id));
  }

  get proyectosFiltradosC() {
    const empresa = this.consumidorContext.empresaSeleccionada();
    const centroId = this.selectedCentroIdC();
    if (!empresa || !centroId || centroId === 'todos') return [];
    return this.proyectosService.proyectos().filter(p =>
      asId(p.cliente_id) === asId(empresa._id) && asId(p.centro_costo_id) === centroId
    );
  }

  // Solicitudes consumidor — '' = Ninguno, 'todos' = Todos, id = específico
  protected solicitudesDeEmpresa = computed(() => {
    const estado = this.filtroEstado();
    const sols = this.solicitudesService.solicitudes()
      .filter(s => !s.centro_costo_id && !s.proyecto_id);
    return estado ? sols.filter(s => s.estado === estado) : sols;
  });

  protected solicitudesDeCentro = computed(() => {
    const centroId = this.selectedCentroIdC();
    if (!centroId) return []; // Ninguno → no mostrar sección
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
    if (!centroId || !proyectoId) return []; // Ninguno en cualquiera → no mostrar
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

  // Solicitudes admin — '' = Ninguno, 'todos' = Todos, id = contexto específico
  protected solicitudesAdmin = computed(() => {
    const sols = this.solicitudesService.solicitudes();
    const centro   = this.selectedCentroId;
    const proyecto = this.selectedProyectoId;

    if (!centro) {
      // Ninguno centro → solo empresa-level
      return sols.filter(s => !s.centro_costo_id && !s.proyecto_id);
    }
    if (centro === 'todos') {
      if (!proyecto) {
        // Todos centros, Ninguno proyecto → centros sin proyectos
        return sols.filter(s => s.centro_costo_id && !s.proyecto_id);
      }
      // Todos centros, Todos proyectos → todo
      return sols;
    }
    // Centro específico
    if (!proyecto) {
      return sols.filter(s => s.centro_costo_id === centro && !s.proyecto_id);
    }
    // Todos proyectos → todo lo del centro
    return sols.filter(s => s.centro_costo_id === centro);
  });

  // ─── getters para nombres ─────────────────────────────────────────────────

  get empresaNombre()  { return this.clientesService.clientes().find(c => c._id === this.selectedEmpresaId)?.razon_social; }
  get centroNombre()   { return this.centrosService.centros().find(c => c._id === this.selectedCentroId)?.nombre; }
  get proyectoNombre() { return this.proyectosService.proyectos().find(p => p._id === this.selectedProyectoId)?.nombre; }

  get empresaNombreC()  { return this.consumidorContext.empresaSeleccionada()?.razon_social; }
  get centroNombreC()   { return this.centrosService.centros().find(c => c._id === this.selectedCentroIdC())?.nombre; }
  get proyectoNombreC() { return this.proyectosService.proyectos().find(p => p._id === this.selectedProyectoIdC())?.nombre; }

  // ─── lifecycle ────────────────────────────────────────────────────────────

  constructor() {
    effect(() => {
      const empresa = this.consumidorContext.empresaSeleccionada();
      if (this.mode() !== 'consumidor') return;
      this.selectedCentroIdC.set('');
      this.selectedProyectoIdC.set('');
      if (empresa) {
        this.service.cargar('empresa', empresa.razon_social);
        this.solicitudesService.cargar(empresa._id);
      } else {
        this.solicitudesService.cargar('');
      }
    });
  }

  ngOnInit(): void {
    this.clientesService.cargar();
    this.centrosService.cargar();
    this.proyectosService.cargar();
  }

  // ─── admin handlers ───────────────────────────────────────────────────────

  onEmpresaChange(): void {
    this.selectedCentroId = '';
    this.selectedProyectoId = '';
    this.service.cargar('empresa', this.empresaNombre);
    this.solicitudesService.cargar(this.selectedEmpresaId);
  }

  onCentroChange(): void {
    this.selectedProyectoId = '';
    const centroId = (this.selectedCentroId && this.selectedCentroId !== 'todos') ? this.selectedCentroId : undefined;
    if (this.selectedCentroId === 'todos') {
      this.service.cargar('empresa', this.empresaNombre);
      this.service.cargarTodosCentros(this.empresaNombre ?? '', this.centrosFiltrados);
    } else if (centroId) {
      this.service.documentosPorCentro.set([]);
      this.service.cargar('centro', this.empresaNombre, this.centroNombre);
    } else {
      this.service.documentosPorCentro.set([]);
      this.service.cargar('empresa', this.empresaNombre);
    }
    this.solicitudesService.cargar(this.selectedEmpresaId, centroId);
  }

  onProyectoChange(): void {
    const centroId   = (this.selectedCentroId   && this.selectedCentroId   !== 'todos') ? this.selectedCentroId   : undefined;
    const proyectoId = (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined;
    if (proyectoId) {
      this.service.cargar('proyecto', this.empresaNombre, this.centroNombre, this.proyectoNombre);
    } else {
      this.service.cargar('centro', this.empresaNombre, this.centroNombre);
    }
    this.solicitudesService.cargar(this.selectedEmpresaId, centroId, proyectoId);
  }

  // ─── consumidor handlers ──────────────────────────────────────────────────

  onCentroChangeC(id: string): void {
    this.selectedCentroIdC.set(id);
    this.selectedProyectoIdC.set('');
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (id === 'todos') {
      this.service.cargar('empresa', this.empresaNombreC);
      this.service.cargarTodosCentros(this.empresaNombreC ?? '', this.centrosFiltradosC);
    } else if (id) {
      this.service.documentosPorCentro.set([]);
      this.service.cargar('centro', this.empresaNombreC, this.centroNombreC);
    } else {
      this.service.documentosPorCentro.set([]);
      this.service.cargar('empresa', this.empresaNombreC);
    }
    if (empresa) this.solicitudesService.cargar(empresa._id);
  }

  onProyectoChangeC(id: string): void {
    this.selectedProyectoIdC.set(id);
    const empresa = this.consumidorContext.empresaSeleccionada();
    const centroId = this.selectedCentroIdC();
    if (id && id !== 'todos') {
      this.service.cargar('proyecto', this.empresaNombreC, this.centroNombreC, this.proyectoNombreC);
    } else if (centroId && centroId !== 'todos') {
      this.service.cargar('centro', this.empresaNombreC, this.centroNombreC);
    } else {
      this.service.cargar('empresa', this.empresaNombreC);
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
    const esConsumidor = this.mode() === 'consumidor';
    this.service.subir(
      p.selectedFile, tipo,
      esConsumidor ? this.empresaNombreC : this.empresaNombre,
      esConsumidor ? this.centroNombreC  : this.centroNombre,
      esConsumidor ? this.proyectoNombreC : this.proyectoNombre,
      esConsumidor ? this.selectedCentroIdC() || undefined : (this.selectedCentroId && this.selectedCentroId !== 'todos') ? this.selectedCentroId : undefined,
      esConsumidor ? this.selectedProyectoIdC() || undefined : (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined,
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
    const filtros = this.panels[tipo].filtrosCategorias;
    const docs = tipo === 'empresa' ? this.service.documentosEmpresa()
      : tipo === 'centro' ? this.service.documentosCentro()
      : this.service.documentosProyecto();
    if (filtros.length === 0) return docs;
    return docs.filter(d => filtros.includes(d.categoria));
  }

  eliminar(filename: string, tipo: DocTipo): void {
    const esConsumidor = this.mode() === 'consumidor';
    this.service.eliminar(
      filename, tipo,
      esConsumidor ? this.empresaNombreC : this.empresaNombre,
      esConsumidor ? this.centroNombreC  : this.centroNombre,
      esConsumidor ? this.proyectoNombreC : this.proyectoNombre,
    );
  }

  // ─── solicitudes (admin) ─────────────────────────────────────────────────

  abrirSolicitudForm(): void {
    this.solicitudForm = this.emptySolicitudForm();
    this.solicitudesService.clearStatus();
    this.showSolicitudForm.set(true);
  }

  cerrarSolicitudForm(): void {
    this.showSolicitudForm.set(false);
  }

  crearSolicitud(): void {
    if (!this.solicitudForm.nombre || !this.selectedEmpresaId) return;
    this.solicitudesService.crear(
      {
        ...this.solicitudForm,
        empresa_id:      this.selectedEmpresaId,
        centro_costo_id: (this.selectedCentroId   && this.selectedCentroId   !== 'todos') ? this.selectedCentroId   : undefined,
        proyecto_id:     (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined,
      },
      () => this.showSolicitudForm.set(false),
    );
  }

  cambiarEstadoSolicitud(id: string, estado: EstadoSolicitud): void {
    this.solicitudesService.cambiarEstado(id, estado);
    this.solicitudEstadoEdit.set(null);
  }

  abrirEditarSolicitud(s: Solicitud): void {
    this.solicitudEditando.set(s._id);
    this.solicitudEstadoEdit.set(null); // cierra panel de estado si estaba abierto
    this.solicitudEditForm = { nombre: s.nombre, tipo: s.tipo, descripcion: s.descripcion ?? '' };
    this.solicitudesService.clearStatus();
  }

  abrirCambioEstado(id: string): void {
    this.solicitudEstadoEdit.set(id);
    this.solicitudEditando.set(null); // cierra panel de edición si estaba abierto
  }

  guardarEdicionSolicitud(): void {
    const id = this.solicitudEditando();
    if (!id) return;
    this.solicitudesService.actualizar(id, this.solicitudEditForm);
    this.solicitudEditando.set(null);
  }

  eliminarSolicitud(id: string): void {
    this.solicitudesService.eliminarSolicitud(id);
  }

  // Estados posibles a los que puede transicionar una solicitud
  estadosDestino(actual: EstadoSolicitud): EstadoDestino[] {
    const map: Record<EstadoSolicitud, EstadoDestino[]> = {
      pendiente: [
        { valor: 'revision',  label: 'Poner en revisión', colorBg: '#dbeafe', colorText: '#1e40af' },
        { valor: 'aprobado',  label: 'Aprobar',           colorBg: '#dcfce7', colorText: '#14532d' },
        { valor: 'rechazado', label: 'Rechazar',          colorBg: '#fee2e2', colorText: '#7f1d1d' },
        { valor: 'vencido',   label: 'Marcar vencido',    colorBg: '#f3f4f6', colorText: '#374151' },
      ],
      revision: [
        { valor: 'aprobado',  label: 'Aprobar',           colorBg: '#dcfce7', colorText: '#14532d' },
        { valor: 'rechazado', label: 'Rechazar',          colorBg: '#fee2e2', colorText: '#7f1d1d' },
        { valor: 'pendiente', label: 'Devolver',          colorBg: '#fef3c7', colorText: '#92400e' },
        { valor: 'vencido',   label: 'Marcar vencido',    colorBg: '#f3f4f6', colorText: '#374151' },
      ],
      aprobado: [
        { valor: 'pendiente', label: 'Reabrir',           colorBg: '#fef3c7', colorText: '#92400e' },
        { valor: 'rechazado', label: 'Rechazar',          colorBg: '#fee2e2', colorText: '#7f1d1d' },
        { valor: 'vencido',   label: 'Marcar vencido',    colorBg: '#f3f4f6', colorText: '#374151' },
      ],
      rechazado: [
        { valor: 'pendiente', label: 'Reabrir',           colorBg: '#fef3c7', colorText: '#92400e' },
        { valor: 'aprobado',  label: 'Aprobar',           colorBg: '#dcfce7', colorText: '#14532d' },
        { valor: 'vencido',   label: 'Marcar vencido',    colorBg: '#f3f4f6', colorText: '#374151' },
      ],
      vencido: [
        { valor: 'pendiente', label: 'Reabrir',           colorBg: '#fef3c7', colorText: '#92400e' },
      ],
    };
    return map[actual] ?? [];
  }

  // Nombre del contexto de una solicitud para mostrar en admin
  contextoLabel(s: Solicitud): string {
    if (s.proyecto_id) {
      const p = this.proyectosService.proyectos().find(x => x._id === s.proyecto_id);
      return `Proyecto: ${p?.nombre ?? s.proyecto_id}`;
    }
    if (s.centro_costo_id) {
      const c = this.centrosService.centros().find(x => x._id === s.centro_costo_id);
      return `Centro: ${c?.nombre ?? s.centro_costo_id}`;
    }
    return 'Empresa';
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
    return { showUpload: false, showFilter: false, nombreInput: '', categoriaInput: 'Contrato', filtrosCategorias: [], selectedFile: null };
  }

  private emptySolicitudForm(): CreateSolicitudDto {
    return { nombre: '', tipo: 'Contrato', descripcion: '', empresa_id: '' };
  }
}
