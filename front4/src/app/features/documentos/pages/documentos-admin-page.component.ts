import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { DocumentosService, DocTipo, CATEGORIAS_DOCUMENTO, DocumentoItem, DocumentoVencidoItem, DocBusquedaItem } from '../documentos.service';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { SolicitudesService, CreateSolicitudDto, UpdateSolicitudDto, EstadoSolicitud, Solicitud } from '../../solicitudes/solicitudes.service';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { AuthService } from '../../auth/auth.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { UploadBubbleComponent } from '../../../shared/components/upload-bubble/upload-bubble.component';
import { UploadDocumentFormComponent } from '../../../shared/components/upload-document-form/upload-document-form.component';
import { DocumentCardListComponent } from '../../../shared/components/document-card-list/document-card-list.component';
import { DocumentoTarjeta } from '../../../shared/models/documento-tarjeta.model';
import { createUploadQueue } from '../../../shared/upload-queue-state';
import { asId, detectarCategoriaDocumento, formatFechaHora, formatBytes, MAX_UPLOAD_SIZE_BYTES, usuarioEstaSuscrito } from '../../../shared/utils';
import { Usuario } from '../../../shared/models/usuario.model';

interface PanelState {
  showUpload: boolean;
  nombreInput: string;
  categoriaInput: string;
  busqueda: string;
  filtrosCategorias: string[];
  selectedFile: File | null;
  modoUpload: 'archivo' | 'link';
  linkInput: string;
}

type FiltroTipo = DocTipo | 'todos';

const collatorNombre = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

export interface FilaDocTodos {
  tipo: DocTipo;
  empresaId: string;
  empresaNombre: string;
  centroId?: string;
  centroNombre?: string;
  proyectoId?: string;
  proyectoNombre?: string;
  doc: DocBusquedaItem;
}

export type OrdenTodos = 'alfabetico' | 'nivel_empresa' | 'nivel_centro' | 'nivel_proyecto';

const RANGOS_POR_MODO: Record<Exclude<OrdenTodos, 'alfabetico'>, DocTipo[]> = {
  nivel_empresa:  ['empresa', 'centro', 'proyecto'],
  nivel_centro:   ['centro', 'proyecto', 'empresa'],
  nivel_proyecto: ['proyecto', 'empresa', 'centro'],
};

export function ordenarFilasTodos(filas: FilaDocTodos[], modo: OrdenTodos): FilaDocTodos[] {
  const resultado = [...filas];
  if (modo === 'alfabetico') {
    resultado.sort((a, b) => collatorNombre.compare(a.doc.nombre_display, b.doc.nombre_display));
    return resultado;
  }
  const rango = RANGOS_POR_MODO[modo];
  resultado.sort((a, b) =>
    (rango.indexOf(a.tipo) - rango.indexOf(b.tipo)) ||
    collatorNombre.compare(a.empresaNombre, b.empresaNombre) ||
    collatorNombre.compare(a.centroNombre ?? '', b.centroNombre ?? '') ||
    collatorNombre.compare(a.proyectoNombre ?? '', b.proyectoNombre ?? '') ||
    collatorNombre.compare(a.doc.nombre_display, b.doc.nombre_display)
  );
  return resultado;
}

type UploadCtx =
  | { kind: 'archivo'; file: File; tipo: DocTipo; empresaId: string; centroId?: string; proyectoId?: string; nombreDisplay?: string; categoria?: string }
  | { kind: 'link'; linkUrl: string; tipo: DocTipo; empresaId: string; centroId?: string; proyectoId?: string; nombreDisplay?: string; categoria?: string };

export interface EstadoDestino {
  valor: EstadoSolicitud;
  label: string;
  colorBg: string;
  colorText: string;
}

@Component({
  selector: 'app-documentos-admin-page',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent, UploadBubbleComponent, UploadDocumentFormComponent, DocumentCardListComponent],
  templateUrl: './documentos-admin-page.component.html',
})
export class DocumentosAdminPageComponent implements OnInit {
  protected readonly service            = inject(DocumentosService);
  protected readonly clientesService    = inject(ClientesService);
  protected readonly centrosService     = inject(CentrosService);
  protected readonly proyectosService   = inject(ProyectosService);
  protected readonly solicitudesService = inject(SolicitudesService);
  protected readonly usuariosService    = inject(UsuariosService);
  private  readonly authService         = inject(AuthService);

  protected readonly puedeVencer = computed(() => {
    const rol = this.authService.usuarioActual()?.rol ?? '';
    return rol === 'super_admin' || rol === 'admin_smartclarity';
  });

  protected readonly categorias = CATEGORIAS_DOCUMENTO;

  private _selectedEmpresaId  = signal('todos');
  private _selectedCentroId   = signal('todos');
  private _selectedProyectoId = signal('todos');

  private busquedaTodosDebounceTimer?: ReturnType<typeof setTimeout>;

  get selectedEmpresaId()  { return this._selectedEmpresaId(); }
  set selectedEmpresaId(v: string)  { this._selectedEmpresaId.set(v); }
  get selectedCentroId()   { return this._selectedCentroId(); }
  set selectedCentroId(v: string)   { this._selectedCentroId.set(v); }
  get selectedProyectoId() { return this._selectedProyectoId(); }
  set selectedProyectoId(v: string) { this._selectedProyectoId.set(v); }

  protected tabJerarquia    = signal<'todos' | 'empresa' | 'centro' | 'proyecto'>('todos');
  protected ordenTodos      = signal<OrdenTodos>('alfabetico');
  protected tabAdminActiva  = signal<'documentacion' | 'solicitudes'>('documentacion');
  protected tabDocAdmin     = signal<'activos' | 'vencidos'>('activos');

  protected showSolicitudForm   = signal(false);
  protected creandoSolicitud    = signal(false);
  protected solicitudForm: CreateSolicitudDto = this.emptySolicitudForm();

  protected busquedaSolicitud     = signal('');
  protected filtrosTipoSolicitud  = signal<string[]>([]);

  limpiarFiltroSolicitudes(): void {
    this.busquedaSolicitud.set('');
    this.filtrosTipoSolicitud.set([]);
  }

  toggleFiltroTipoSolicitud(cat: string): void {
    this.filtrosTipoSolicitud.update(filtros =>
      filtros.includes(cat) ? filtros.filter(c => c !== cat) : [...filtros, cat]
    );
  }

  isFiltroTipoSolicitudSelected(cat: string): boolean {
    return this.filtrosTipoSolicitud().includes(cat);
  }

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

  // Admins ya suscritos al ámbito de la solicitud: siempre reciben la
  // notificación, su checkbox no se puede deseleccionar.
  protected adminsSuscritosSolicitudIds = computed(() =>
    this.adminsParaSolicitud().filter(u => this.estaSuscritoAdminSolicitud(u)).map(u => u._id)
  );

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

  protected adminsSuscritosRechazoIds = computed(() =>
    this.adminsParaRechazo().filter(u => this.estaSuscritoAdminRechazo(u)).map(u => u._id)
  );

  // modal vencer documento (centroIdReal/proyectoIdReal/empresaIdReal/tipoReal solo cuando viene de una vista "todos")
  protected modalVencer = signal<{ url: string; nombre_display: string; categoria: string; centroIdReal?: string; proyectoIdReal?: string; empresaIdReal?: string; tipoReal?: DocTipo } | null>(null);

  protected empresaIdParaVencer = computed(() => this.modalVencer()?.empresaIdReal ?? this.selectedEmpresaId);

  // notificación — vencer documento
  protected notifVencerNotificar   = signal(false);
  protected notifVencerTab         = signal<'usuarios' | 'admins' | 'super-admins'>('usuarios');
  protected notifVencerUsuariosIds = signal<string[]>([]);
  protected notifVencerAdminsIds   = signal<string[]>([]);
  protected notifVencerSuperAdmins = signal(false);

  protected notifVencerTodosUsuariosSeleccionados = computed(() => {
    const u = this.usuariosParaVencer();
    return u.length > 0 && u.every(x => this.notifVencerUsuariosIds().includes(x._id));
  });

  protected notifVencerTodosAdminsSeleccionados = computed(() => {
    const a = this.adminsParaVencer();
    return a.length > 0 && a.every(x => this.notifVencerAdminsIds().includes(x._id));
  });

  protected adminsSuscritosVencerIds = computed(() =>
    this.adminsParaVencer().filter(u => this.estaSuscritoAdminVencer(u)).map(u => u._id)
  );

  protected panels: Record<FiltroTipo, PanelState> = {
    todos:    this.emptyPanel(),
    empresa:  this.emptyPanel(),
    centro:   this.emptyPanel(),
    proyecto: this.emptyPanel(),
  };

  protected readonly uploadQueue = createUploadQueue();
  private readonly retryContext = new Map<string, UploadCtx>();

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

  protected solicitudesEnSolicitudes = computed(() => {
    const busqueda = this.busquedaSolicitud().trim().toLowerCase();
    const tipos    = this.filtrosTipoSolicitud();
    return this.solicitudesTabActual()
      .filter(s => s.estado !== 'aprobado')
      .filter(s => !busqueda || s.nombre.toLowerCase().includes(busqueda))
      .filter(s => !tipos.length || tipos.includes(s.tipo));
  });

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

  protected usuariosParaVencer = computed(() => {
    const empresaId = this.empresaIdParaVencer();
    if (!empresaId) return [];
    return this.usuariosService.usuarios().filter(u =>
      u.rol === 'usuario' && asId(u.cliente_id) === empresaId
    );
  });

  protected adminsParaVencer = computed(() => {
    if (!this.empresaIdParaVencer()) return [];
    return this.usuariosService.usuarios().filter(u => u.rol === 'admin_smartclarity');
  });

  protected superAdminsParaVencer = computed(() =>
    this.usuariosService.usuarios().filter(u => u.rol === 'super_admin')
  );

  protected estaSuscritoAdminSolicitud(u: Usuario): boolean {
    const centroId = (this.selectedCentroId && this.selectedCentroId !== 'todos') ? this.selectedCentroId : undefined;
    const proyectoId = (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined;
    return usuarioEstaSuscrito(u, this.selectedEmpresaId, centroId, proyectoId);
  }

  protected estaSuscritoAdminRechazo(u: Usuario): boolean {
    return usuarioEstaSuscrito(u, this.rechazandoEmpresaId(), this.rechazandoCentroId() || undefined);
  }

  protected estaSuscritoAdminVencer(u: Usuario): boolean {
    const m = this.modalVencer();
    return usuarioEstaSuscrito(u, this.empresaIdParaVencer(), m?.centroIdReal, m?.proyectoIdReal);
  }

  // ─── getters ──────────────────────────────────────────────────────────────

  get centrosFiltrados() {
    if (!this.selectedEmpresaId) return [];
    if (this.selectedEmpresaId === 'todos') return this.centrosService.centros();
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === this.selectedEmpresaId);
  }

  get proyectosFiltrados() {
    if (!this.selectedEmpresaId || !this.selectedCentroId || this.selectedCentroId === 'todos') return [];
    return this.proyectosService.proyectos().filter(p =>
      asId(p.cliente_id) === this.selectedEmpresaId && (p.centro_costo_ids ?? []).some(id => asId(id) === this.selectedCentroId)
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
    return (this.tabJerarquia() === 'empresa' && !!this.selectedEmpresaId && this.selectedEmpresaId !== 'todos') ||
      (this.tabJerarquia() === 'centro'   && !!this.selectedCentroId   && this.selectedCentroId   !== 'todos') ||
      (this.tabJerarquia() === 'proyecto' && !!this.selectedProyectoId && this.selectedProyectoId !== 'todos');
  }

  get tieneContenido(): boolean {
    if (this.tabJerarquia() === 'todos') return true;
    return !!this.selectedEmpresaId && (
      this.tabJerarquia() === 'empresa' ||
      (this.tabJerarquia() === 'centro'   && !!this.selectedCentroId) ||
      (this.tabJerarquia() === 'proyecto' && !!this.selectedCentroId && !!this.selectedProyectoId)
    );
  }

  protected filasTodos = computed<FilaDocTodos[]>(() => {
    // Un Proyecto puede pertenecer a varios centros, así que aparece una vez por cada
    // centro en el árbol (ver documentos-busqueda.service.ts) — sus documentos vienen
    // repetidos (mismo _id) tantas veces como centros comparta. Se deduplica manteniendo
    // la primera aparición: si no, el mismo _id en 2+ filas hace que el menú de
    // categoría (indexado por doc._id) se abra en todas a la vez.
    const vistos = new Set<string>();
    const filas: FilaDocTodos[] = [];
    for (const empresa of this.service.busquedaCascada()) {
      for (const doc of empresa.documentos) {
        if (vistos.has(doc._id)) continue;
        vistos.add(doc._id);
        filas.push({ tipo: 'empresa', empresaId: empresa._id, empresaNombre: empresa.nombre, doc });
      }
      for (const centro of empresa.centros) {
        for (const doc of centro.documentos) {
          if (vistos.has(doc._id)) continue;
          vistos.add(doc._id);
          filas.push({ tipo: 'centro', empresaId: centro.empresa_id, empresaNombre: empresa.nombre, centroId: centro._id, centroNombre: centro.nombre, doc });
        }
        for (const proyecto of centro.proyectos) {
          for (const doc of proyecto.documentos) {
            if (vistos.has(doc._id)) continue;
            vistos.add(doc._id);
            filas.push({
              tipo: 'proyecto',
              empresaId: proyecto.empresa_id, empresaNombre: empresa.nombre,
              centroId: proyecto.centro_id, centroNombre: centro.nombre,
              proyectoId: proyecto._id, proyectoNombre: proyecto.nombre,
              doc,
            });
          }
        }
      }
    }
    return ordenarFilasTodos(filas, this.ordenTodos());
  });

  formatFecha(fecha?: string): string {
    if (!fecha) return '—';
    const d = new Date(fecha);
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${meses[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  protected readonly formatFechaHora = formatFechaHora;

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
        .filter(x => (x.centro_costo_ids ?? []).some(id => asId(id) === c))
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
    if (this.selectedEmpresaId === 'todos') {
      this.service.cargarTodasEmpresas();
      this.solicitudesService.solicitudes.set([]);
    } else {
      this.solicitudesService.cargar(this.selectedEmpresaId);
    }
    this.usuariosService.cargar();
    this.refrescarBusquedaCascada();
  }

  // ─── admin handlers ───────────────────────────────────────────────────────

  onEmpresaChange(): void {
    this.selectedCentroId = 'todos';
    this.selectedProyectoId = 'todos';
    this.tabJerarquia.set('empresa');
    this.tabAdminActiva.set('documentacion');
    this.tabDocAdmin.set('activos');
    this.service.documentosVencidos.set([]);
    this.service.documentosCentro.set([]);
    this.service.documentosProyecto.set([]);
    this.service.documentosPorCentro.set([]);
    this.service.documentosPorProyecto.set([]);
    if (this.selectedEmpresaId === 'todos') {
      this.service.documentosEmpresa.set([]);
      this.service.cargarTodasEmpresas();
      this.solicitudesService.solicitudes.set([]);
    } else if (this.selectedEmpresaId) {
      this.service.cargarEmpresa(this.selectedEmpresaId);
      this.solicitudesService.cargar(this.selectedEmpresaId);
    } else {
      this.service.documentosEmpresa.set([]);
      this.solicitudesService.cargar(this.selectedEmpresaId);
    }
  }

  onCentroChange(): void {
    const estabaEnVencidos = this.tabDocAdmin() === 'vencidos';
    this.selectedProyectoId = 'todos';
    if (!estabaEnVencidos) this.tabDocAdmin.set('activos');
    this.service.documentosVencidos.set([]);
    this.service.documentosPorProyecto.set([]);
    if (this.selectedCentroId) this.tabJerarquia.set('centro');
    const centroId = (this.selectedCentroId && this.selectedCentroId !== 'todos') ? this.selectedCentroId : undefined;
    if (this.selectedEmpresaId === 'todos') {
      // Los datos ya están en service.documentosTodasEmpresas(); no hace falta pedir nada.
      this.service.documentosCentro.set([]);
      this.service.documentosPorCentro.set([]);
    } else if (this.selectedCentroId === 'todos') {
      this.service.documentosCentro.set([]);
      this.service.cargarTodosCentros(this.selectedEmpresaId, this.centrosFiltrados);
    } else if (centroId) {
      this.service.documentosPorCentro.set([]);
      this.service.cargar('centro', this.selectedEmpresaId, centroId);
    } else {
      this.service.documentosPorCentro.set([]);
      this.service.documentosCentro.set([]);
    }
    if (this.selectedEmpresaId === 'todos') {
      this.solicitudesService.solicitudes.set([]);
    } else {
      this.solicitudesService.cargar(this.selectedEmpresaId, centroId);
    }
    if (estabaEnVencidos) this.cargarVencidosAdmin();
  }

  onProyectoChange(): void {
    const estabaEnVencidos = this.tabDocAdmin() === 'vencidos';
    if (!estabaEnVencidos) this.tabDocAdmin.set('activos');
    this.service.documentosVencidos.set([]);
    if (this.selectedProyectoId) this.tabJerarquia.set('proyecto');
    const centroId   = (this.selectedCentroId   && this.selectedCentroId   !== 'todos') ? this.selectedCentroId   : undefined;
    const proyectoId = (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined;

    this.service.documentosProyecto.set([]);
    this.service.documentosPorProyecto.set([]);

    if (this.selectedEmpresaId === 'todos') {
      // Los datos ya están en service.documentosTodasEmpresas(); no hace falta pedir nada.
    } else if (this.selectedProyectoId === 'todos' && this.selectedCentroId === 'todos') {
      const todos = this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === this.selectedEmpresaId);
      this.service.cargarTodosProyectos(this.selectedEmpresaId, todos, this.centrosFiltrados);
    } else if (this.selectedProyectoId === 'todos' && centroId) {
      const delCentro = this.proyectosService.proyectos().filter(
        p => asId(p.cliente_id) === this.selectedEmpresaId && (p.centro_costo_ids ?? []).some(id => asId(id) === centroId)
      );
      this.service.cargarTodosProyectos(this.selectedEmpresaId, delCentro, this.centrosFiltrados);
    } else if (proyectoId && centroId) {
      this.service.cargar('proyecto', this.selectedEmpresaId, centroId, proyectoId);
    } else if (centroId) {
      this.service.cargar('centro', this.selectedEmpresaId, centroId);
    }
    if (this.selectedEmpresaId === 'todos') {
      this.solicitudesService.solicitudes.set([]);
    } else {
      this.solicitudesService.cargar(this.selectedEmpresaId, centroId, proyectoId);
    }
    if (estabaEnVencidos) this.cargarVencidosAdmin();
  }

  // ─── upload panels ────────────────────────────────────────────────────────

  toggleUpload(tipo: DocTipo): void {
    const p = this.panels[tipo];
    p.showUpload = !p.showUpload;
    if (!p.showUpload) {
      p.selectedFile = null; p.nombreInput = ''; p.linkInput = ''; p.modoUpload = 'archivo';
      this.uploadQueue.items().filter(i => i.kind === 'archivo').forEach(i => this.uploadQueue.quitar(i.id));
    }
  }

  setModoUpload(tipo: DocTipo, modo: 'archivo' | 'link'): void {
    const p = this.panels[tipo];
    if (p.modoUpload === modo) return;
    p.modoUpload = modo;
    p.selectedFile = null;
    p.linkInput = '';
    p.nombreInput = '';
  }

  linkInvalido(tipo: DocTipo): boolean {
    const link = this.panels[tipo].linkInput.trim();
    if (!link) return false;
    return !/^https?:\/\/.+/i.test(link);
  }

  onArchivoChange(file: File | null, tipo: DocTipo): void {
    if (!file) return;
    const categoria = detectarCategoriaDocumento(file.name) ?? 'Otros';
    const id = this.uploadQueue.agregar(file.name, 'archivo', categoria);
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      this.uploadQueue.marcarError(id, `El archivo pesa ${formatBytes(file.size)} y supera el límite de 20 MB. Selecciona uno más liviano.`);
      return;
    }
    const empresaId = this.selectedEmpresaId;
    const centroId = (this.selectedCentroId && this.selectedCentroId !== 'todos') ? this.selectedCentroId : undefined;
    const proyectoId = (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined;
    const ctx: UploadCtx = { kind: 'archivo', file, tipo, empresaId, centroId, proyectoId, categoria };
    this.retryContext.set(id, ctx);
    this.ejecutarSubida(id, ctx);
  }

  tarjetasArchivoSubiendo(tipo: DocTipo): DocumentoTarjeta[] {
    return this.uploadQueue.items()
      .filter(i => i.kind === 'archivo')
      .map(i => ({
        id: i.id,
        nombre: i.nombre,
        tipoContenido: 'archivo' as const,
        estado: i.estado,
        categoria: i.categoria,
      }));
  }

  onCategoriaTarjetaChange(event: { id: string; categoria: string }, tipo: DocTipo): void {
    this.uploadQueue.actualizarCategoria(event.id, event.categoria);
    const item = this.uploadQueue.items().find(i => i.id === event.id);
    if (item?.estado === 'listo' && item.docUrl) {
      this.service.actualizarCategoria(item.docUrl, event.categoria, tipo);
    }
  }

  onEliminarTarjeta(id: string, tipo: DocTipo): void {
    const item = this.uploadQueue.items().find(i => i.id === id);
    if (item?.estado === 'listo' && item.docUrl) {
      this.eliminar(item.docUrl, tipo);
    }
    this.uploadQueue.quitar(id);
  }

  archivoDemasiadoGrande(tipo: DocTipo): boolean {
    const file = this.panels[tipo].selectedFile;
    return !!file && file.size > MAX_UPLOAD_SIZE_BYTES;
  }

  mensajeArchivoDemasiadoGrande(tipo: DocTipo): string {
    const file = this.panels[tipo].selectedFile;
    if (!file) return '';
    return `El archivo pesa ${formatBytes(file.size)} y supera el límite de 20 MB. Selecciona uno más liviano.`;
  }

  confirmarSubida(tipo: DocTipo): void {
    const p = this.panels[tipo];
    const empresaId = this.selectedEmpresaId;
    const centroId = (this.selectedCentroId && this.selectedCentroId !== 'todos') ? this.selectedCentroId : undefined;
    const proyectoId = (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined;

    const link = p.linkInput.trim();
    if (!link || this.linkInvalido(tipo)) return;
    const ctx: UploadCtx = { kind: 'link', linkUrl: link, tipo, empresaId, centroId, proyectoId, nombreDisplay: p.nombreInput || undefined, categoria: p.categoriaInput || undefined };
    const nombreParaCola = p.nombreInput || link;

    const id = this.uploadQueue.agregar(nombreParaCola, 'link', ctx.categoria);
    this.retryContext.set(id, ctx);
    this.ejecutarSubida(id, ctx);

    p.selectedFile = null;
    p.nombreInput = '';
    p.linkInput = '';
    p.showUpload = false;
  }

  reintentarSubida(id: string): void {
    const ctx = this.retryContext.get(id);
    if (!ctx) return;
    this.uploadQueue.reiniciar(id);
    this.ejecutarSubida(id, ctx);
  }

  cerrarUploadBubble(): void {
    this.uploadQueue.limpiar();
    this.retryContext.clear();
  }

  itemsLinkParaBurbuja() {
    return this.uploadQueue.items().filter(i => i.kind === 'link');
  }

  private ejecutarSubida(id: string, ctx: UploadCtx): void {
    const onError = (err: any) => {
      if (err?.status === 413) {
        this.uploadQueue.marcarError(id, 'El archivo supera el límite de 20MB.');
        return;
      }
      const raw = err?.error?.message;
      const text = Array.isArray(raw) ? raw.join('. ') : (raw ?? err?.message ?? 'Error al cargar');
      this.uploadQueue.marcarError(id, text);
    };

    if (ctx.kind === 'link') {
      this.service.subirLink(ctx.linkUrl, ctx.tipo, ctx.empresaId, ctx.centroId, ctx.proyectoId, ctx.nombreDisplay, ctx.categoria)
        .subscribe({
          next: () => { this.uploadQueue.marcarListo(id); this.retryContext.delete(id); },
          error: onError,
        });
      return;
    }

    this.service.subir(ctx.file, ctx.tipo, ctx.empresaId, ctx.centroId, ctx.proyectoId, ctx.nombreDisplay, ctx.categoria)
      .subscribe({
        next: (event: HttpEvent<DocumentoItem>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadQueue.actualizarProgreso(id, Math.round((100 * event.loaded) / event.total));
          } else if (event.type === HttpEventType.Response) {
            this.uploadQueue.marcarListo(id, event.body?.url);
            this.retryContext.delete(id);
          }
        },
        error: onError,
      });
  }

  toggleFiltroCategoria(tipo: FiltroTipo, cat: string): void {
    const filtros = this.panels[tipo].filtrosCategorias;
    const idx = filtros.indexOf(cat);
    if (idx === -1) filtros.push(cat);
    else filtros.splice(idx, 1);
    this.refrescarBusquedaCascada();
  }

  isFiltroSelected(tipo: FiltroTipo, cat: string): boolean {
    return this.panels[tipo].filtrosCategorias.includes(cat);
  }

  categoriaTag(cat: string): string | null {
    return cat.match(/^\[([^\]]+)\]/)?.[1] ?? null;
  }

  categoriaResto(cat: string): string {
    return cat.replace(/^\[[^\]]+\]\s*/, '');
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

  vencidosFiltrados(): DocumentoVencidoItem[] {
    const { filtrosCategorias, busqueda } = this.panels[this.docTipoActual];
    const term = busqueda.trim().toLowerCase();
    return this.service.documentosVencidos()
      .filter(d => !filtrosCategorias.length || filtrosCategorias.includes(d.categoria ?? ''))
      .filter(d => !term || d.nombre_display.toLowerCase().includes(term));
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

  docsEmpresaTodas(): { doc: DocBusquedaItem; empresaId: string; empresaNombre: string }[] {
    const { filtrosCategorias, busqueda } = this.panels['empresa'];
    const term = busqueda.trim().toLowerCase();
    const filas: { doc: DocBusquedaItem; empresaId: string; empresaNombre: string }[] = [];
    for (const empresa of this.service.documentosTodasEmpresas()) {
      for (const doc of empresa.documentos) filas.push({ doc, empresaId: empresa._id, empresaNombre: empresa.nombre });
    }
    return filas
      .filter(f => !filtrosCategorias.length || filtrosCategorias.includes(f.doc.categoria ?? ''))
      .filter(f => !term || f.doc.nombre_display.toLowerCase().includes(term));
  }

  docsCentroTodas(): { doc: DocBusquedaItem; empresaId: string; empresaNombre: string; centroId: string; centroNombre: string }[] {
    const { filtrosCategorias, busqueda } = this.panels['centro'];
    const term = busqueda.trim().toLowerCase();
    const filas: { doc: DocBusquedaItem; empresaId: string; empresaNombre: string; centroId: string; centroNombre: string }[] = [];
    for (const empresa of this.service.documentosTodasEmpresas()) {
      for (const centro of empresa.centros) {
        for (const doc of centro.documentos) {
          filas.push({ doc, empresaId: empresa._id, empresaNombre: empresa.nombre, centroId: centro._id, centroNombre: centro.nombre });
        }
      }
    }
    return filas
      .filter(f => !filtrosCategorias.length || filtrosCategorias.includes(f.doc.categoria ?? ''))
      .filter(f => !term || f.doc.nombre_display.toLowerCase().includes(term));
  }

  docsProyectoTodas(): { doc: DocBusquedaItem; empresaId: string; empresaNombre: string; centroId: string; centroNombre: string; proyectoId: string; proyectoNombre: string }[] {
    const { filtrosCategorias, busqueda } = this.panels['proyecto'];
    const term = busqueda.trim().toLowerCase();
    const filas: { doc: DocBusquedaItem; empresaId: string; empresaNombre: string; centroId: string; centroNombre: string; proyectoId: string; proyectoNombre: string }[] = [];
    for (const empresa of this.service.documentosTodasEmpresas()) {
      for (const centro of empresa.centros) {
        for (const proyecto of centro.proyectos) {
          for (const doc of proyecto.documentos) {
            filas.push({
              doc, empresaId: empresa._id, empresaNombre: empresa.nombre,
              centroId: centro._id, centroNombre: centro.nombre,
              proyectoId: proyecto._id, proyectoNombre: proyecto.nombre,
            });
          }
        }
      }
    }
    return filas
      .filter(f => !filtrosCategorias.length || filtrosCategorias.includes(f.doc.categoria ?? ''))
      .filter(f => !term || f.doc.nombre_display.toLowerCase().includes(term));
  }

  eliminar(docUrl: string, tipo: DocTipo): void {
    this.service.eliminar(docUrl, tipo, this.selectedEmpresaId, this.selectedCentroId || undefined, this.selectedProyectoId || undefined);
  }

  protected categoriaMenuAbierto = signal<string | null>(null);

  toggleCategoriaMenu(docId: string): void {
    this.categoriaMenuAbierto.update(actual => actual === docId ? null : docId);
  }

  seleccionarCategoria(docUrl: string, categoria: string, tipo: DocTipo): void {
    this.categoriaMenuAbierto.set(null);
    this.service.actualizarCategoria(docUrl, categoria, tipo);
  }

  seleccionarCategoriaTodos(docUrl: string, categoria: string): void {
    this.categoriaMenuAbierto.set(null);
    this.service.actualizarCategoria(docUrl, categoria, 'empresa', () => this.refrescarBusquedaCascada());
  }

  seleccionarCategoriaTodasEmpresas(docUrl: string, categoria: string, tipo: DocTipo): void {
    this.categoriaMenuAbierto.set(null);
    this.service.actualizarCategoria(docUrl, categoria, tipo, () => this.service.cargarTodasEmpresas());
  }

  abrirDocumento(d: { tipo_contenido?: 'archivo' | 'link'; link_url?: string; url: string; nombre_display: string }): void {
    if (d.tipo_contenido === 'link' && d.link_url) window.open(d.link_url, '_blank', 'noopener');
    else this.service.descargar(d.url, d.nombre_display);
  }

  eliminarEnTodosCentros(docUrl: string): void {
    const empresaId = this.selectedEmpresaId;
    this.service.eliminar(docUrl, 'centro', empresaId, undefined, undefined,
      () => this.service.cargarTodosCentros(empresaId, this.centrosFiltrados));
  }

  eliminarEnTodosProyectos(docUrl: string): void {
    const empresaId = this.selectedEmpresaId;
    const todos = this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === empresaId);
    this.service.eliminar(docUrl, 'proyecto', empresaId, undefined, undefined,
      () => this.service.cargarTodosProyectos(empresaId, todos, this.centrosFiltrados));
  }

  eliminarEnTodos(docUrl: string): void {
    this.service.eliminar(docUrl, 'empresa', '', undefined, undefined, () => this.refrescarBusquedaCascada());
  }

  eliminarEnTodasEmpresas(docUrl: string, empresaId: string): void {
    this.service.eliminar(docUrl, 'empresa', empresaId, undefined, undefined,
      () => this.service.cargarTodasEmpresas());
  }

  eliminarCentroEnTodasEmpresas(docUrl: string, empresaId: string, centroId: string): void {
    this.service.eliminar(docUrl, 'centro', empresaId, centroId, undefined,
      () => this.service.cargarTodasEmpresas());
  }

  eliminarProyectoEnTodasEmpresas(docUrl: string, empresaId: string, centroId: string, proyectoId: string): void {
    this.service.eliminar(docUrl, 'proyecto', empresaId, centroId, proyectoId,
      () => this.service.cargarTodasEmpresas());
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
      this.notifSolicitudAdminsIds.set(this.adminsSuscritosSolicitudIds());
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
    if (this.adminsSuscritosSolicitudIds().includes(id)) return;
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
      this.notifRechazoAdminsIds.set(this.adminsSuscritosRechazoIds());
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
    if (this.adminsSuscritosRechazoIds().includes(id)) return;
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
    if (!this.solicitudForm.nombre || !this.selectedEmpresaId || this.selectedEmpresaId === 'todos') return;
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
          : superAdmins
            ? { notificar: true, audiencia: 'especificos' as const, destinatarios_ids: [], notificar_super_admins: true }
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
          p => asId(p.cliente_id) === empresaId && (p.centro_costo_ids ?? []).some(id => asId(id) === cId)
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
          : superAdmins
            ? { notificar: true, audiencia: 'especificos' as const, destinatarios_ids: [], notificar_super_admins: true }
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
      ],
      revision: [
        { valor: 'aprobado',  label: 'Aprobar',           colorBg: '#dcfce7', colorText: '#14532d' },
        { valor: 'rechazado', label: 'Rechazar',          colorBg: '#fee2e2', colorText: '#7f1d1d' },
        { valor: 'pendiente', label: 'Devolver',          colorBg: '#fef3c7', colorText: '#92400e' },
      ],
      aprobado: [],
      rechazado: [
        { valor: 'pendiente', label: 'Reabrir',           colorBg: '#fef3c7', colorText: '#92400e' },
        { valor: 'aprobado',  label: 'Aprobar',           colorBg: '#dcfce7', colorText: '#14532d' },
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

  contextoTagStyle(s: Solicitud): { color: string; bg: string } {
    if (s.proyecto_id) return { color: '#d97706', bg: 'rgba(245,158,11,.1)' };
    if (s.centro_costo_id) return { color: '#059669', bg: 'rgba(16,185,129,.1)' };
    return { color: '#0095d6', bg: 'rgba(0,149,214,.1)' };
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

  activarTabVencidosAdmin(): void {
    this.tabDocAdmin.set('vencidos');
    this.cargarVencidosAdmin();
  }

  seleccionarTabJerarquia(tab: 'todos' | 'empresa' | 'centro' | 'proyecto'): void {
    this.tabJerarquia.set(tab);
    this.tabAdminActiva.set('documentacion');
    if (this.tabDocAdmin() === 'vencidos') this.cargarVencidosAdmin();
    this.refrescarBusquedaCascada();
  }

  refrescarBusquedaCascada(): void {
    if (this.tabJerarquia() !== 'todos') return;
    const { filtrosCategorias, busqueda } = this.panels['todos'];
    this.service.buscarCascada('empresa', filtrosCategorias, busqueda);
  }

  onBusquedaNombreChange(tipo: FiltroTipo, valor: string): void {
    this.panels[tipo].busqueda = valor;
    if (tipo === 'todos') {
      // Debounce: cada tecla dispara un GET /documentos/busqueda-total sobre
      // todas las empresas — sin esto se manda un request por carácter tipeado.
      clearTimeout(this.busquedaTodosDebounceTimer);
      this.busquedaTodosDebounceTimer = setTimeout(() => this.refrescarBusquedaCascada(), 300);
      return;
    }
    this.refrescarBusquedaCascada();
  }

  limpiarFiltroDocTipo(tipo: FiltroTipo): void {
    if (tipo === 'todos') clearTimeout(this.busquedaTodosDebounceTimer);
    this.panels[tipo].busqueda = '';
    this.panels[tipo].filtrosCategorias = [];
    this.refrescarBusquedaCascada();
  }

  cargarVencidosAdmin(): void {
    const empresaId = this.selectedEmpresaId;
    if (!empresaId || empresaId === 'todos') { this.service.documentosVencidos.set([]); return; }
    const tab = this.tabJerarquia();
    const centroId   = tab !== 'empresa' && this.selectedCentroId   && this.selectedCentroId   !== 'todos' ? this.selectedCentroId   : undefined;
    const proyectoId = tab === 'proyecto' && this.selectedProyectoId && this.selectedProyectoId !== 'todos' ? this.selectedProyectoId : undefined;
    const tipo: 'empresa' | 'centro' | 'proyecto' = tab === 'centro' || tab === 'proyecto' ? tab : 'empresa';
    this.service.cargarVencidos(empresaId, centroId, proyectoId, tipo);
  }

  marcarVencidoAdmin(docUrl: string): void {
    const tipo       = this.docTipoActual;
    const empresaId  = this.selectedEmpresaId;
    const centroId   = (this.selectedCentroId   && this.selectedCentroId   !== 'todos') ? this.selectedCentroId   : undefined;
    const proyectoId = (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined;
    this.service.marcarVencido(
      docUrl, tipo, empresaId, centroId, proyectoId,
      this.empresaNombre, this.centroNombre, this.proyectoNombre,
    );
  }

  abrirModalVencer(doc: { url: string; nombre_display: string; categoria?: string }, centroIdReal?: string, proyectoIdReal?: string, empresaIdReal?: string, tipoReal?: DocTipo): void {
    this.modalVencer.set({ url: doc.url, nombre_display: doc.nombre_display, categoria: doc.categoria ?? '', centroIdReal, proyectoIdReal, empresaIdReal, tipoReal });
    this.notifVencerNotificar.set(true);
    this.notifVencerTab.set('usuarios');
    this.notifVencerUsuariosIds.set(this.usuariosParaVencer().map(u => u._id));
    this.notifVencerAdminsIds.set(this.adminsParaVencer().map(u => u._id));
    this.notifVencerSuperAdmins.set(false);
  }

  cerrarModalVencer(): void {
    this.modalVencer.set(null);
  }

  confirmarVencer(): void {
    const m = this.modalVencer();
    if (!m) return;

    const notif       = this.notifVencerNotificar();
    const selIds      = [...this.notifVencerUsuariosIds(), ...this.notifVencerAdminsIds()];
    const superAdmins = this.notifVencerSuperAdmins();

    const notificacion = !notif
      ? { notificar: false as const }
      : selIds.length === 0
        ? { notificar: true as const, audiencia: 'todos' as const, notificar_super_admins: superAdmins }
        : { notificar: true as const, audiencia: 'especificos' as const, destinatarios_ids: selIds, notificar_super_admins: superAdmins };

    const tipo       = m.tipoReal ?? this.docTipoActual;
    const empresaId  = m.empresaIdReal ?? this.selectedEmpresaId;
    const centroId   = m.centroIdReal ?? ((this.selectedCentroId   !== 'todos') ? this.selectedCentroId   : undefined);
    const proyectoId = m.proyectoIdReal ?? ((this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined);

    const empresaNombreReal = m.empresaIdReal ? (this.clientesService.clientes().find(c => c._id === m.empresaIdReal)?.razon_social ?? this.empresaNombre) : this.empresaNombre;
    const centroNombreReal   = centroId   ? (this.centrosService.centros().find(c => asId(c._id) === centroId)?.nombre   ?? this.centroNombre)   : this.centroNombre;
    const proyectoNombreReal = proyectoId ? (this.proyectosService.proyectos().find(p => asId(p._id) === proyectoId)?.nombre ?? this.proyectoNombre) : this.proyectoNombre;

    let onSuccess: (() => void) | undefined;
    if (this.tabJerarquia() === 'todos') {
      onSuccess = () => this.refrescarBusquedaCascada();
    } else if (this.selectedEmpresaId === 'todos') {
      onSuccess = () => this.service.cargarTodasEmpresas();
    } else if (this.selectedCentroId === 'todos' && m.centroIdReal) {
      onSuccess = () => this.service.cargarTodosCentros(empresaId, this.centrosFiltrados);
    } else if (this.selectedProyectoId === 'todos' && m.proyectoIdReal) {
      onSuccess = () => {
        const todos = this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === empresaId);
        this.service.cargarTodosProyectos(empresaId, todos, this.centrosFiltrados);
      };
    }

    this.service.marcarVencido(
      m.url, tipo, empresaId, centroId, proyectoId,
      empresaNombreReal, centroNombreReal, proyectoNombreReal,
      notificacion,
      onSuccess,
    );
    this.cerrarModalVencer();
  }

  toggleNotifVencerNotificar(): void { this.notifVencerNotificar.update(v => !v); }

  toggleSeleccionarTodosUsuariosVencer(): void {
    if (this.notifVencerTodosUsuariosSeleccionados()) {
      this.notifVencerUsuariosIds.set([]);
    } else {
      this.notifVencerUsuariosIds.set(this.usuariosParaVencer().map(u => u._id));
    }
  }

  toggleSeleccionarTodosAdminsVencer(): void {
    if (this.notifVencerTodosAdminsSeleccionados()) {
      this.notifVencerAdminsIds.set(this.adminsSuscritosVencerIds());
    } else {
      this.notifVencerAdminsIds.set(this.adminsParaVencer().map(u => u._id));
    }
  }

  toggleNotifVencerUsuario(id: string): void {
    this.notifVencerUsuariosIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }

  toggleNotifVencerAdmin(id: string): void {
    if (this.adminsSuscritosVencerIds().includes(id)) return;
    this.notifVencerAdminsIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }

  // ─── private helpers ─────────────────────────────────────────────────────

  private emptyPanel(): PanelState {
    return { showUpload: false, nombreInput: '', categoriaInput: 'Contratos', busqueda: '', filtrosCategorias: [], selectedFile: null, modoUpload: 'archivo', linkInput: '' };
  }

  private emptySolicitudForm(): CreateSolicitudDto {
    return { nombre: '', tipo: 'Contratos', descripcion: '', empresa_id: '' };
  }
}
