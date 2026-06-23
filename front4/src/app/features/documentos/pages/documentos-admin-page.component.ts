import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocumentosService, DocTipo, CATEGORIAS_DOCUMENTO, DocumentoItem } from '../documentos.service';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { SolicitudesService, CreateSolicitudDto, UpdateSolicitudDto, EstadoSolicitud, Solicitud } from '../../solicitudes/solicitudes.service';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { asId } from '../../../shared/utils';

interface PanelState {
  showUpload: boolean;
  showFilter: boolean;
  nombreInput: string;
  categoriaInput: string;
  busqueda: string;
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
  selector: 'app-documentos-admin-page',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent],
  templateUrl: './documentos-admin-page.component.html',
})
export class DocumentosAdminPageComponent implements OnInit {
  protected readonly service            = inject(DocumentosService);
  protected readonly clientesService    = inject(ClientesService);
  protected readonly centrosService     = inject(CentrosService);
  protected readonly proyectosService   = inject(ProyectosService);
  protected readonly solicitudesService = inject(SolicitudesService);
  protected readonly usuariosService    = inject(UsuariosService);

  protected readonly categorias = CATEGORIAS_DOCUMENTO;

  private _selectedEmpresaId  = signal('');
  private _selectedCentroId   = signal('');
  private _selectedProyectoId = signal('');

  get selectedEmpresaId()  { return this._selectedEmpresaId(); }
  set selectedEmpresaId(v: string)  { this._selectedEmpresaId.set(v); }
  get selectedCentroId()   { return this._selectedCentroId(); }
  set selectedCentroId(v: string)   { this._selectedCentroId.set(v); }
  get selectedProyectoId() { return this._selectedProyectoId(); }
  set selectedProyectoId(v: string) { this._selectedProyectoId.set(v); }

  protected tabJerarquia    = signal<'empresa' | 'centro' | 'proyecto'>('empresa');
  protected tabAdminActiva  = signal<'documentacion' | 'solicitudes'>('documentacion');

  protected showSolicitudForm   = signal(false);
  protected creandoSolicitud    = signal(false);
  protected solicitudForm: CreateSolicitudDto = this.emptySolicitudForm();

  protected solicitudEstadoEdit = signal<string | null>(null);
  protected rechazandoId        = signal<string | null>(null);
  protected motivoRechazoInput  = '';

  protected solicitudEditando  = signal<string | null>(null);
  protected solicitudEditForm: UpdateSolicitudDto = {};

  // notificación — crear solicitud
  protected notifSolicitudNotificar   = signal(true);
  protected notifSolicitudTab         = signal<'usuarios' | 'admins' | 'super-admins'>('usuarios');
  protected notifSolicitudUsuariosIds = signal<string[]>([]);
  protected notifSolicitudAdminsIds   = signal<string[]>([]);
  protected notifSolicitudSuperAdmins = signal(false);

  protected notifSolicitudTodosUsuariosSeleccionados = computed(() => {
    const u = this.usuariosParaSolicitud();
    return u.length > 0 && u.every(x => this.notifSolicitudUsuariosIds().includes(x._id));
  });

  protected notifSolicitudTodosAdminsSeleccionados = computed(() => {
    const a = this.adminsParaSolicitud();
    return a.length > 0 && a.every(x => this.notifSolicitudAdminsIds().includes(x._id));
  });

  // notificación — rechazo
  protected notifRechazoNotificar   = signal(true);
  protected notifRechazoTab         = signal<'usuarios' | 'admins' | 'super-admins'>('usuarios');
  protected notifRechazoUsuariosIds = signal<string[]>([]);
  protected notifRechazoAdminsIds   = signal<string[]>([]);
  protected notifRechazoSuperAdmins = signal(false);

  protected notifRechazoTodosUsuariosSeleccionados = computed(() => {
    const u = this.usuariosParaRechazo();
    return u.length > 0 && u.every(x => this.notifRechazoUsuariosIds().includes(x._id));
  });

  protected notifRechazoTodosAdminsSeleccionados = computed(() => {
    const a = this.adminsParaRechazo();
    return a.length > 0 && a.every(x => this.notifRechazoAdminsIds().includes(x._id));
  });

  protected panels: Record<DocTipo, PanelState> = {
    empresa:  this.emptyPanel(),
    centro:   this.emptyPanel(),
    proyecto: this.emptyPanel(),
  };

  constructor() {
    effect(() => {
      if (this.solicitudesService.status()?.type === 'error') {
        this.creandoSolicitud.set(false);
      }
    });
  }

  // ─── computed ─────────────────────────────────────────────────────────────

  protected solicitudesAdmin = computed(() => {
    const sols   = this.solicitudesService.solicitudes();
    const centro   = this.selectedCentroId;
    const proyecto = this.selectedProyectoId;
    if (!centro) return sols.filter(s => !s.centro_costo_id && !s.proyecto_id);
    if (centro === 'todos') {
      if (!proyecto) return sols.filter(s => s.centro_costo_id && !s.proyecto_id);
      return sols;
    }
    if (!proyecto) return sols.filter(s => s.centro_costo_id === centro && !s.proyecto_id);
    return sols.filter(s => s.centro_costo_id === centro);
  });

  protected solicitudesEnSolicitudes = computed(() =>
    this.solicitudesTabActual().filter(s => s.estado !== 'aprobado')
  );

  protected usuariosParaSolicitud = computed(() => {
    const empresaId = this.selectedEmpresaId;
    if (!empresaId) return [];
    const centroId = this.selectedCentroId;
    const usuariosEmpresa = this.usuariosService.usuarios().filter(u =>
      u.rol === 'usuario' && asId(u.cliente_id) === empresaId
    );
    if (!centroId || centroId === 'todos') return usuariosEmpresa;
    return usuariosEmpresa.filter(u =>
      u.centros_asignados.some(c => asId(c) === centroId)
    );
  });

  protected rechazandoCentroId = computed(() => {
    const id = this.rechazandoId();
    if (!id) return '';
    return this.solicitudesService.solicitudes().find(s => s._id === id)?.centro_costo_id ?? '';
  });

  protected rechazandoEmpresaId = computed(() => {
    const id = this.rechazandoId();
    if (!id) return '';
    return this.solicitudesService.solicitudes().find(s => s._id === id)?.empresa_id ?? '';
  });

  protected usuariosParaRechazo = computed(() => {
    const empresaId = this.rechazandoEmpresaId();
    if (!empresaId) return [];
    const centroId = this.rechazandoCentroId();
    const usuariosEmpresa = this.usuariosService.usuarios().filter(u =>
      u.rol === 'usuario' && asId(u.cliente_id) === empresaId
    );
    if (!centroId) return usuariosEmpresa;
    return usuariosEmpresa.filter(u =>
      u.centros_asignados.some(c => asId(c) === centroId)
    );
  });

  protected adminsParaSolicitud = computed(() => {
    if (!this.selectedEmpresaId) return [];
    return this.usuariosService.usuarios().filter(u => u.rol === 'admin_smartclarity');
  });

  protected superAdminsParaSolicitud = computed(() =>
    this.usuariosService.usuarios().filter(u => u.rol === 'super_admin')
  );

  protected adminsParaRechazo = computed(() => {
    const empresaId = this.rechazandoEmpresaId();
    if (!empresaId) return [];
    return this.usuariosService.usuarios().filter(u => u.rol === 'admin_smartclarity');
  });

  protected superAdminsParaRechazo = computed(() =>
    this.usuariosService.usuarios().filter(u => u.rol === 'super_admin')
  );

  // ─── getters ──────────────────────────────────────────────────────────────

  get centrosFiltrados() {
    if (!this.selectedEmpresaId) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === this.selectedEmpresaId);
  }

  get proyectosFiltrados() {
    if (!this.selectedEmpresaId || !this.selectedCentroId || this.selectedCentroId === 'todos') return [];
    return this.proyectosService.proyectos().filter(p =>
      asId(p.cliente_id) === this.selectedEmpresaId && asId(p.centro_costo_id) === this.selectedCentroId
    );
  }

  get empresaNombre()  { return this.clientesService.clientes().find(c => c._id === this.selectedEmpresaId)?.razon_social; }
  get centroNombre()   { return this.centrosService.centros().find(c => c._id === this.selectedCentroId)?.nombre; }
  get proyectoNombre() { return this.proyectosService.proyectos().find(p => p._id === this.selectedProyectoId)?.nombre; }

  get empresaSeleccionadaObj() { return this.clientesService.clientes().find(c => c._id === this.selectedEmpresaId) ?? null; }

  get centroSeleccionado() {
    const id = this.selectedCentroId;
    if (!id || id === 'todos') return null;
    return this.centrosService.centros().find(c => c._id === id) ?? null;
  }

  get proyectoSeleccionado() {
    const id = this.selectedProyectoId;
    if (!id || id === 'todos') return null;
    return this.proyectosService.proyectos().find(p => p._id === id) ?? null;
  }

  get docTipoActual(): DocTipo {
    return this.tabJerarquia() === 'empresa' ? 'empresa'
      : this.tabJerarquia() === 'centro' ? 'centro'
      : 'proyecto';
  }

  get puedeGestionarDocumento(): boolean {
    return this.tabJerarquia() === 'empresa' ||
      (this.tabJerarquia() === 'centro'   && !!this.selectedCentroId   && this.selectedCentroId   !== 'todos') ||
      (this.tabJerarquia() === 'proyecto' && !!this.selectedProyectoId && this.selectedProyectoId !== 'todos');
  }

  get tieneContenido(): boolean {
    return !!this.selectedEmpresaId && (
      this.tabJerarquia() === 'empresa' ||
      (this.tabJerarquia() === 'centro'   && !!this.selectedCentroId) ||
      (this.tabJerarquia() === 'proyecto' && !!this.selectedCentroId && !!this.selectedProyectoId)
    );
  }

  formatFecha(fecha?: string): string {
    if (!fecha) return '—';
    const d = new Date(fecha);
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${meses[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  solicitudesTabActual(): Solicitud[] {
    const tab = this.tabJerarquia();
    const all = this.solicitudesService.solicitudes();
    if (tab === 'empresa') return all.filter(s => !s.centro_costo_id && !s.proyecto_id);
    if (tab === 'centro') {
      const c = this.selectedCentroId;
      if (!c) return [];
      if (c === 'todos') return all.filter(s => s.centro_costo_id && !s.proyecto_id);
      return all.filter(s => s.centro_costo_id === c && !s.proyecto_id);
    }
    const c = this.selectedCentroId;
    const p = this.selectedProyectoId;
    if (!c || !p) return [];
    if (p === 'todos') {
      if (c === 'todos') return all.filter(s => !!s.proyecto_id);
      const ids = this.proyectosService.proyectos()
        .filter(x => asId(x.centro_costo_id) === c)
        .map(x => asId(x._id));
      return all.filter(s => s.proyecto_id && ids.includes(s.proyecto_id));
    }
    return all.filter(s => s.proyecto_id === p);
  }

  // ─── lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.clientesService.cargar();
    this.centrosService.cargar();
    this.proyectosService.cargar();
    this.solicitudesService.cargar(this.selectedEmpresaId);
    this.usuariosService.cargar();
  }

  // ─── admin handlers ───────────────────────────────────────────────────────

  onEmpresaChange(): void {
    this.selectedCentroId = '';
    this.selectedProyectoId = '';
    this.tabJerarquia.set('empresa');
    this.tabAdminActiva.set('documentacion');
    this.service.documentosCentro.set([]);
    this.service.documentosProyecto.set([]);
    this.service.documentosPorCentro.set([]);
    this.service.documentosPorProyecto.set([]);
    if (this.selectedEmpresaId) this.service.cargarEmpresa(this.selectedEmpresaId);
    else this.service.documentosEmpresa.set([]);
    this.solicitudesService.cargar(this.selectedEmpresaId);
  }

  onCentroChange(): void {
    this.selectedProyectoId = '';
    this.service.documentosPorProyecto.set([]);
    if (this.selectedCentroId) this.tabJerarquia.set('centro');
    const centroId = (this.selectedCentroId && this.selectedCentroId !== 'todos') ? this.selectedCentroId : undefined;
    if (this.selectedCentroId === 'todos') {
      this.service.documentosCentro.set([]);
      this.service.cargarTodosCentros(this.selectedEmpresaId, this.centrosFiltrados);
    } else if (centroId) {
      this.service.documentosPorCentro.set([]);
      this.service.cargar('centro', this.selectedEmpresaId, centroId);
    } else {
      this.service.documentosPorCentro.set([]);
      this.service.documentosCentro.set([]);
    }
    this.solicitudesService.cargar(this.selectedEmpresaId, centroId);
  }

  onProyectoChange(): void {
    if (this.selectedProyectoId) this.tabJerarquia.set('proyecto');
    const centroId   = (this.selectedCentroId   && this.selectedCentroId   !== 'todos') ? this.selectedCentroId   : undefined;
    const proyectoId = (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined;

    this.service.documentosProyecto.set([]);
    this.service.documentosPorProyecto.set([]);

    if (this.selectedProyectoId === 'todos' && this.selectedCentroId === 'todos') {
      const todos = this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === this.selectedEmpresaId);
      this.service.cargarTodosProyectos(this.selectedEmpresaId, todos, this.centrosFiltrados);
    } else if (this.selectedProyectoId === 'todos' && centroId) {
      const delCentro = this.proyectosService.proyectos().filter(
        p => asId(p.cliente_id) === this.selectedEmpresaId && asId(p.centro_costo_id) === centroId
      );
      this.service.cargarTodosProyectos(this.selectedEmpresaId, delCentro, this.centrosFiltrados);
    } else if (proyectoId && centroId) {
      this.service.cargar('proyecto', this.selectedEmpresaId, centroId, proyectoId);
    } else if (centroId) {
      this.service.cargar('centro', this.selectedEmpresaId, centroId);
    }
    this.solicitudesService.cargar(this.selectedEmpresaId, centroId, proyectoId);
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
  }

  confirmarSubida(tipo: DocTipo): void {
    const p = this.panels[tipo];
    if (!p.selectedFile) return;
    this.service.subir(
      p.selectedFile, tipo,
      this.selectedEmpresaId,
      (this.selectedCentroId   && this.selectedCentroId   !== 'todos') ? this.selectedCentroId   : undefined,
      (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined,
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

  filteredDocsPorCentro() {
    const { busqueda, filtrosCategorias } = this.panels['centro'];
    const term = busqueda.trim().toLowerCase();
    return this.service.documentosPorCentro()
      .map(item => ({
        ...item,
        docs: item.docs
          .filter(d => !filtrosCategorias.length || filtrosCategorias.includes(d.categoria ?? ''))
          .filter(d => !term || d.nombre_display.toLowerCase().includes(term)),
      }))
      .filter(item => item.docs.length > 0);
  }

  filteredDocsPorProyecto() {
    const { busqueda, filtrosCategorias } = this.panels['proyecto'];
    const term = busqueda.trim().toLowerCase();
    return this.service.documentosPorProyecto()
      .map(item => ({
        ...item,
        docs: item.docs
          .filter(d => !filtrosCategorias.length || filtrosCategorias.includes(d.categoria ?? ''))
          .filter(d => !term || d.nombre_display.toLowerCase().includes(term)),
      }))
      .filter(item => item.docs.length > 0);
  }

  docsFiltrados(tipo: DocTipo): DocumentoItem[] {
    const docs = tipo === 'empresa' ? this.service.documentosEmpresa()
      : tipo === 'centro' ? this.service.documentosCentro()
      : this.service.documentosProyecto();
    const { filtrosCategorias, busqueda } = this.panels[tipo];
    const term = busqueda.trim().toLowerCase();
    return docs
      .filter(d => !filtrosCategorias.length || filtrosCategorias.includes(d.categoria ?? ''))
      .filter(d => !term || d.nombre_display.toLowerCase().includes(term));
  }

  eliminar(docUrl: string, tipo: DocTipo): void {
    this.service.eliminar(docUrl, tipo, this.selectedEmpresaId, this.selectedCentroId || undefined, this.selectedProyectoId || undefined);
  }

  // ─── solicitudes (admin) ─────────────────────────────────────────────────

  toggleNotifSolicitudNotificar(): void { this.notifSolicitudNotificar.update(v => !v); }
  toggleSeleccionarTodosUsuariosSolicitud(): void {
    if (this.notifSolicitudTodosUsuariosSeleccionados()) {
      this.notifSolicitudUsuariosIds.set([]);
    } else {
      this.notifSolicitudUsuariosIds.set(this.usuariosParaSolicitud().map(u => u._id));
    }
  }
  toggleSeleccionarTodosAdminsSolicitud(): void {
    if (this.notifSolicitudTodosAdminsSeleccionados()) {
      this.notifSolicitudAdminsIds.set([]);
    } else {
      this.notifSolicitudAdminsIds.set(this.adminsParaSolicitud().map(u => u._id));
    }
  }
  toggleNotifSolicitudUsuario(id: string): void {
    this.notifSolicitudUsuariosIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }
  toggleNotifSolicitudAdmin(id: string): void {
    this.notifSolicitudAdminsIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }

  toggleNotifRechazoNotificar(): void { this.notifRechazoNotificar.update(v => !v); }
  toggleSeleccionarTodosUsuariosRechazo(): void {
    if (this.notifRechazoTodosUsuariosSeleccionados()) {
      this.notifRechazoUsuariosIds.set([]);
    } else {
      this.notifRechazoUsuariosIds.set(this.usuariosParaRechazo().map(u => u._id));
    }
  }
  toggleSeleccionarTodosAdminsRechazo(): void {
    if (this.notifRechazoTodosAdminsSeleccionados()) {
      this.notifRechazoAdminsIds.set([]);
    } else {
      this.notifRechazoAdminsIds.set(this.adminsParaRechazo().map(u => u._id));
    }
  }
  toggleNotifRechazoUsuario(id: string): void {
    this.notifRechazoUsuariosIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }
  toggleNotifRechazoAdmin(id: string): void {
    this.notifRechazoAdminsIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }

  abrirSolicitudForm(): void {
    this.solicitudForm = this.emptySolicitudForm();
    this.notifSolicitudNotificar.set(true);
    this.notifSolicitudTab.set('usuarios');
    this.notifSolicitudUsuariosIds.set(this.usuariosParaSolicitud().map(u => u._id));
    this.notifSolicitudAdminsIds.set(this.adminsParaSolicitud().map(u => u._id));
    this.notifSolicitudSuperAdmins.set(false);
    this.solicitudesService.clearStatus();
    this.showSolicitudForm.set(true);
  }

  cerrarSolicitudForm(): void { this.showSolicitudForm.set(false); }

  crearSolicitud(): void {
    if (!this.solicitudForm.nombre || !this.selectedEmpresaId) return;
    const tab = this.tabJerarquia();
    const centroId   = tab !== 'empresa' && this.selectedCentroId   !== 'todos' ? this.selectedCentroId   : undefined;
    const proyectoId = tab === 'proyecto' && this.selectedProyectoId !== 'todos' ? this.selectedProyectoId : undefined;
    const notif      = this.notifSolicitudNotificar();
    const todosU     = this.usuariosParaSolicitud().map(u => u._id);
    const todosA     = this.adminsParaSolicitud().map(u => u._id);
    const selU       = this.notifSolicitudUsuariosIds();
    const selA       = this.notifSolicitudAdminsIds();
    const esCompleto = todosU.every(id => selU.includes(id)) && todosA.every(id => selA.includes(id));
    const superAdmins = this.notifSolicitudSuperAdmins();
    const destinatariosSol = [...selU, ...selA];
    const notificacion = !notif
      ? { notificar: false }
      : esCompleto
        ? { notificar: true, audiencia: 'todos' as const, notificar_super_admins: superAdmins }
        : destinatariosSol.length > 0
          ? { notificar: true, audiencia: 'especificos' as const, destinatarios_ids: destinatariosSol, notificar_super_admins: superAdmins }
          : { notificar: false };
    this.creandoSolicitud.set(true);
    this.solicitudesService.crear({
      ...this.solicitudForm,
      empresa_id: this.selectedEmpresaId,
      centro_costo_id: centroId,
      proyecto_id: proyectoId,
      notificacion,
    }, () => { this.creandoSolicitud.set(false); this.showSolicitudForm.set(false); });
  }

  iniciarCambioEstado(id: string, estado: EstadoSolicitud): void {
    if (estado === 'rechazado') {
      this.rechazandoId.set(id);
      this.motivoRechazoInput = '';
      this.notifRechazoNotificar.set(true);
      this.notifRechazoTab.set('usuarios');
      this.notifRechazoUsuariosIds.set(this.usuariosParaRechazo().map(u => u._id));
      this.notifRechazoAdminsIds.set(this.adminsParaRechazo().map(u => u._id));
      this.notifRechazoSuperAdmins.set(false);
      this.solicitudEstadoEdit.set(null);
    } else {
      const onSuccess = estado === 'aprobado' ? () => this.recargarDocs() : undefined;
      this.solicitudesService.cambiarEstado(id, estado, undefined, undefined, onSuccess);
      this.solicitudEstadoEdit.set(null);
    }
  }

  private recargarDocs(): void {
    const empresaId  = this.selectedEmpresaId;
    const centroId   = this.selectedCentroId;
    const proyectoId = this.selectedProyectoId;
    const tab = this.tabJerarquia();
    if (!empresaId) return;
    if (tab === 'empresa') {
      this.service.cargarEmpresa(empresaId);
    } else if (tab === 'centro') {
      if (centroId === 'todos') {
        this.service.cargarTodosCentros(empresaId, this.centrosFiltrados);
      } else if (centroId) {
        this.service.cargar('centro', empresaId, centroId);
      }
    } else if (tab === 'proyecto') {
      const cId = centroId !== 'todos' ? centroId : undefined;
      const pId = proyectoId !== 'todos' ? proyectoId : undefined;
      if (proyectoId === 'todos' && centroId === 'todos') {
        const todos = this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === empresaId);
        this.service.cargarTodosProyectos(empresaId, todos, this.centrosFiltrados);
      } else if (proyectoId === 'todos' && cId) {
        const delCentro = this.proyectosService.proyectos().filter(
          p => asId(p.cliente_id) === empresaId && asId(p.centro_costo_id) === cId
        );
        this.service.cargarTodosProyectos(empresaId, delCentro, this.centrosFiltrados);
      } else if (pId && cId) {
        this.service.cargar('proyecto', empresaId, cId, pId);
      }
    }
  }

  confirmarRechazo(): void {
    const id = this.rechazandoId();
    if (!id) return;
    const notif      = this.notifRechazoNotificar();
    const todosU     = this.usuariosParaRechazo().map(u => u._id);
    const todosA     = this.adminsParaRechazo().map(u => u._id);
    const selU       = this.notifRechazoUsuariosIds();
    const selA       = this.notifRechazoAdminsIds();
    const esCompleto = todosU.every(id => selU.includes(id)) && todosA.every(id => selA.includes(id));
    const superAdmins = this.notifRechazoSuperAdmins();
    const destinatariosRec = [...selU, ...selA];
    const notificacion = !notif
      ? { notificar: false }
      : esCompleto
        ? { notificar: true, audiencia: 'todos' as const, notificar_super_admins: superAdmins }
        : destinatariosRec.length > 0
          ? { notificar: true, audiencia: 'especificos' as const, destinatarios_ids: destinatariosRec, notificar_super_admins: superAdmins }
          : { notificar: false };
    this.solicitudesService.cambiarEstado(id, 'rechazado', this.motivoRechazoInput, notificacion);
    this.rechazandoId.set(null);
    this.motivoRechazoInput = '';
  }

  cancelarRechazo(): void { this.rechazandoId.set(null); this.motivoRechazoInput = ''; }

  cambiarEstadoSolicitud(id: string, estado: EstadoSolicitud): void { this.iniciarCambioEstado(id, estado); }

  abrirEditarSolicitud(s: Solicitud): void {
    this.solicitudEditando.set(s._id);
    this.solicitudEstadoEdit.set(null);
    this.solicitudEditForm = { nombre: s.nombre, tipo: s.tipo, descripcion: s.descripcion ?? '' };
    this.solicitudesService.clearStatus();
  }

  abrirCambioEstado(id: string): void {
    this.solicitudEstadoEdit.set(id);
    this.solicitudEditando.set(null);
  }

  guardarEdicionSolicitud(): void {
    const id = this.solicitudEditando();
    if (!id) return;
    this.solicitudesService.actualizar(id, this.solicitudEditForm);
    this.solicitudEditando.set(null);
  }

  eliminarSolicitud(id: string): void { this.solicitudesService.eliminarSolicitud(id); }

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
        { valor: 'vencido',   label: 'Marcar vencido',    colorBg: '#f3f4f6', colorText: '#374151' },
      ],
      rechazado: [
        { valor: 'pendiente', label: 'Reabrir',           colorBg: '#fef3c7', colorText: '#92400e' },
        { valor: 'aprobado',  label: 'Aprobar',           colorBg: '#dcfce7', colorText: '#14532d' },
        { valor: 'vencido',   label: 'Marcar vencido',    colorBg: '#f3f4f6', colorText: '#374151' },
      ],
      vencido: [
        { valor: 'revision',  label: 'Poner en revisión', colorBg: '#dbeafe', colorText: '#1e40af' },
        { valor: 'aprobado',  label: 'Aprobar',           colorBg: '#dcfce7', colorText: '#14532d' },
        { valor: 'rechazado', label: 'Rechazar',          colorBg: '#fee2e2', colorText: '#7f1d1d' },
      ],
    };
    return map[actual] ?? [];
  }

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
      pendiente: 'Pendiente', revision: 'En revisión',
      aprobado: 'Aprobado',   rechazado: 'Rechazado',
      vencido: 'Vencido',
    };
    return map[estado];
  }

  // ─── private helpers ─────────────────────────────────────────────────────

  private emptyPanel(): PanelState {
    return { showUpload: false, showFilter: false, nombreInput: '', categoriaInput: 'Contratos', busqueda: '', filtrosCategorias: [], selectedFile: null };
  }

  private emptySolicitudForm(): CreateSolicitudDto {
    return { nombre: '', tipo: 'Contratos', descripcion: '', empresa_id: '' };
  }
}
