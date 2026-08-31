import { Component, OnInit, inject, signal, computed, effect, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { DocumentosService, DocTipo, CATEGORIAS_DOCUMENTO, DocumentoItem } from '../documentos.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { ActividadesService } from '../../actividades/actividades.service';
import { ActivosService } from '../../activos/activos.service';
import { DocActividad } from '../../../shared/models/actividad.model';
import { DocActivo } from '../../../shared/models/activo.model';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { SolicitudesService, EstadoSolicitud, Solicitud } from '../../solicitudes/solicitudes.service';
import { AuthService } from '../../auth/auth.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { UploadBubbleComponent } from '../../../shared/components/upload-bubble/upload-bubble.component';
import { UploadDocumentFormComponent } from '../../../shared/components/upload-document-form/upload-document-form.component';
import { DocumentCardListComponent } from '../../../shared/components/document-card-list/document-card-list.component';
import { DocumentoTarjeta } from '../../../shared/models/documento-tarjeta.model';
import { createUploadQueue } from '../../../shared/upload-queue-state';
import { asId, confirmarEliminacion, detectarCategoriaDocumento, formatFechaHora, formatBytes, MAX_UPLOAD_SIZE_BYTES, ordenarPorDocumento, OrdenDocumentos } from '../../../shared/utils';

// Las 5 dimensiones de "Agrupar por" — reemplaza al viejo tabJerarquia +
// el tab "Todos" (que combinaba empresa/centro/proyecto en una sola vista).
export type Grupo = 'empresa' | 'centro' | 'proyecto' | 'actividad' | 'activo';

interface GrupoFila<T> {
  nombre: string;
  id: string;
  centroId?: string; // requerido por ActivosService para resolver la empresa
  meta?: string; // p.ej. nombre del centro, para actividad/activo/proyecto
  docs: T[];
}

// El botón "Subir documentos" es independiente de los filtros de búsqueda — el
// destino (dónde adjuntar) se elige dentro del propio modal, con su propia
// cascada empresa(fija)→centro→proyecto/actividad/activo.
type DestinoTipo = 'empresa' | 'centro' | 'proyecto' | 'actividad' | 'activo';

interface ModalUploadCtx {
  kind: 'archivo' | 'link';
  file?: File;
  linkUrl?: string;
  destinoTipo: DestinoTipo;
  empresaId: string;
  centroId?: string;
  proyectoId?: string;
  actividadId?: string;
  activoId?: string;
  nombreDisplay?: string;
  categoria?: string;
}

@Component({
  selector: 'app-documentos-consumidor-page',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule, StatusBannerComponent, UploadBubbleComponent, UploadDocumentFormComponent, DocumentCardListComponent],
  templateUrl: './documentos-consumidor-page.component.html',
})
export class DocumentosConsumidorPageComponent implements OnInit {
  protected readonly service            = inject(DocumentosService);
  protected readonly centrosService     = inject(CentrosService);
  protected readonly proyectosService   = inject(ProyectosService);
  protected readonly actividadesService = inject(ActividadesService);
  protected readonly activosService     = inject(ActivosService);
  protected readonly consumidorContext  = inject(ConsumidorContextService);
  protected readonly solicitudesService = inject(SolicitudesService);
  protected readonly authService          = inject(AuthService);
  private  readonly route                 = inject(ActivatedRoute);

  protected readonly categorias = CATEGORIAS_DOCUMENTO;

  // ─── filtros de Solicitudes (sub-tab aparte, sin relación con "Agrupar por") ──
  protected solicitudAmbito      = signal<'empresa' | 'centro' | 'proyecto'>('empresa');
  protected solicitudCentroId    = signal('todos');
  protected solicitudProyectoId  = signal('todos');
  protected filtroEstado         = signal<EstadoSolicitud | ''>('');
  protected filtroTipoSolicitud  = signal('');
  protected busquedaEmpresa      = signal('');
  protected busquedaCentro       = signal('');
  protected busquedaProyecto     = signal('');
  protected tabConsumidorActiva  = signal<'documentacion' | 'solicitudes'>('documentacion');

  // ─── estado del filtro de Documentos: "pendiente" (lo que el usuario toca) vs
  // "aplicado" (lo que efectivamente se usó en el último clic en Buscar) ───────
  protected grupoPendiente = signal<Grupo>('empresa');
  protected grupoAplicado  = signal<Grupo>('empresa');

  protected centroIdPendiente    = signal('todos');
  protected proyectoIdPendiente  = signal('todos');
  protected actividadIdPendiente = signal('todos');
  protected activoIdPendiente    = signal('todos');

  protected centroIdAplicado    = signal('todos');
  protected proyectoIdAplicado  = signal('todos');
  protected actividadIdAplicado = signal('todos');
  protected activoIdAplicado    = signal('todos');

  protected categoriasPendiente = signal<string[]>([]);
  protected categoriasAplicado  = signal<string[]>([]);
  protected busquedaPendiente   = signal('');
  protected busquedaAplicada    = signal('');
  protected estadoPendiente     = signal<'activos' | 'vencidos'>('activos');
  protected estadoAplicado      = signal<'activos' | 'vencidos'>('activos');
  protected ordenPendiente      = signal<OrdenDocumentos>('alfabetico');
  protected ordenAplicado       = signal<OrdenDocumentos>('alfabetico');

  protected dropdownTipoAbierto = signal(false);

  protected solicitudAdjuntando = signal<string | null>(null);
  protected adjuntoFile: File | null = null;
  protected adjuntoModo = signal<'archivo' | 'link'>('archivo');
  protected adjuntoLinkInput = '';
  protected adjuntando = signal(false);

  // ─── modal "Subir documentos" — independiente de los filtros de búsqueda:
  // el destino (empresa/centro/proyecto/actividad/activo) se elige adentro. ──
  protected uploadModalAbierto  = signal(false);
  protected uploadDestinoTipo   = signal<DestinoTipo>('empresa');
  protected uploadCentroId      = signal('');
  protected uploadProyectoId    = signal('');
  protected uploadActividadId   = signal('');
  protected uploadActivoId      = signal('');
  protected uploadModoUpload    = signal<'archivo' | 'link'>('archivo');
  protected uploadLinkInput     = '';
  protected uploadNombreInput   = '';
  protected uploadCategoriaInput = 'Contratos';

  protected readonly uploadQueue = createUploadQueue();
  private readonly retryContext = new Map<string, ModalUploadCtx>();

  // Resultado de la búsqueda por actividad/activo (sin endpoint agregador propio,
  // se arma en el componente vía forkJoin — ver ejecutarBusquedaActividad/Activo).
  protected filasActividad = signal<GrupoFila<DocActividad>[]>([]);
  protected filasActivo    = signal<GrupoFila<DocActivo>[]>([]);
  protected cargandoGrupo  = signal(false);

  private _pendingCentroId   = signal<string | null>(null);
  private _pendingProyectoId = signal<string | null>(null);

  // ─── computed: opciones de los selects, en cascada por centro (pendiente) ──

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
    const centroId = this.centroIdPendiente();
    if (!empresa || !centroId || centroId === 'todos') return [];
    return this.proyectosService.proyectos().filter(p =>
      asId(p.cliente_id) === asId(empresa._id) && (p.centro_costo_ids ?? []).some(id => asId(id) === centroId)
    );
  }

  get actividadesFiltradasC() {
    const centroId = this.centroIdPendiente();
    if (!centroId) return [];
    const todas = this.actividadesService.actividades();
    return centroId === 'todos' ? todas : todas.filter(a => asId(a.centro_costo_id) === centroId);
  }

  get activosFiltradosC() {
    const centroId = this.centroIdPendiente();
    if (!centroId) return [];
    const todos = this.activosService.activos();
    return centroId === 'todos' ? todos : todos.filter(a => asId(a.centro_costo_id) === centroId);
  }

  // ─── cascada del modal "Subir documentos" — independiente de la cascada de
  // filtros de arriba (esa es "centroIdPendiente"-driven, ésta usa uploadCentroId) ──

  get uploadProyectosDisponibles() {
    const empresa = this.consumidorContext.empresaSeleccionada();
    const centroId = this.uploadCentroId();
    if (!empresa || !centroId) return [];
    return this.proyectosService.proyectos().filter(p =>
      asId(p.cliente_id) === asId(empresa._id) && (p.centro_costo_ids ?? []).some(id => asId(id) === centroId)
    );
  }

  get uploadActividadesDisponibles() {
    const centroId = this.uploadCentroId();
    if (!centroId) return [];
    return this.actividadesService.actividades().filter(a => asId(a.centro_costo_id) === centroId);
  }

  get uploadActivosDisponibles() {
    const centroId = this.uploadCentroId();
    if (!centroId) return [];
    return this.activosService.activos().filter(a => asId(a.centro_costo_id) === centroId);
  }

  puedeSubirDestino(tipo: string): boolean {
    if (tipo === 'actividad') return this.puedeDocActividad('subir');
    if (tipo === 'activo') return this.puedeDocActivo('subir');
    return this.puedeDoc(tipo as DocTipo, 'subir');
  }

  get puedeSubirAlgunDestino(): boolean {
    return (['empresa', 'centro', 'proyecto', 'actividad', 'activo'] as DestinoTipo[]).some(t => this.puedeSubirDestino(t));
  }

  get uploadDestinoListo(): boolean {
    const t = this.uploadDestinoTipo();
    if (t === 'empresa') return true;
    if (t === 'centro') return !!this.uploadCentroId();
    if (t === 'proyecto') return !!this.uploadCentroId() && !!this.uploadProyectoId();
    if (t === 'actividad') return !!this.uploadCentroId() && !!this.uploadActividadId();
    return !!this.uploadCentroId() && !!this.uploadActivoId();
  }

  // Solo empresa/centro/proyecto tienen docUrl reutilizable para editar/borrar
  // desde la tarjeta de subida — actividad/activo se corrigen desde su propia
  // pestaña una vez subidos.
  get mostrarCategoriaModal(): boolean {
    const t = this.uploadDestinoTipo();
    return t === 'empresa' || t === 'centro' || t === 'proyecto';
  }

  get empresaNombreC()  { return this.consumidorContext.empresaSeleccionada()?.razon_social; }
  get centroNombreC()   { return this.centrosService.centros().find(c => c._id === this.centroIdAplicado())?.nombre; }
  get proyectoNombreC() { return this.proyectosService.proyectos().find(p => p._id === this.proyectoIdAplicado())?.nombre; }
  get actividadNombreC() { return this.actividadesService.actividades().find(a => a._id === this.actividadIdAplicado())?.nombre; }
  get activoNombreC()    { return this.activosService.activos().find(a => a._id === this.activoIdAplicado())?.nombre; }

  get empresaSeleccionadaObj() { return this.consumidorContext.empresaSeleccionada(); }

  get docTipoActual(): DocTipo {
    return this.grupoAplicado() === 'empresa' ? 'empresa'
      : this.grupoAplicado() === 'centro' ? 'centro'
      : 'proyecto';
  }

  private seccionDoc(tipo?: DocTipo): 'docEmpresa' | 'docCentro' | 'docProyecto' {
    if (tipo === 'empresa') return 'docEmpresa';
    if (tipo === 'proyecto') return 'docProyecto';
    return 'docCentro';
  }

  protected puedeDoc(tipo: DocTipo | undefined, accion: 'subir' | 'editarCategoria' | 'vencer' | 'eliminar'): boolean {
    return this.authService.tienePermiso(this.seccionDoc(tipo), accion);
  }

  protected puedeDocActividad(accion: 'subir' | 'editarCategoria' | 'eliminar'): boolean {
    return this.authService.tienePermiso('docActividad', accion);
  }

  protected puedeDocActivo(accion: 'subir' | 'editarCategoria' | 'eliminar'): boolean {
    return this.authService.tienePermiso('docActivo', accion);
  }

  // Solo hay "un centro/proyecto activo" (para Subir y Vigentes/Vencidos) cuando
  // el grupo aplicado es esa dimensión y hay exactamente un valor elegido (no
  // 'todos'). Reemplaza al viejo selectedCentroIdC/selectedProyectoIdC, que ahora
  // quedan reservados para el sub-tab de Solicitudes.
  get puedeGestionarDocumento(): boolean {
    const g = this.grupoAplicado();
    return g === 'empresa' ||
      (g === 'centro'   && !!this.centroIdAplicado()   && this.centroIdAplicado()   !== 'todos') ||
      (g === 'proyecto' && !!this.proyectoIdAplicado() && this.proyectoIdAplicado() !== 'todos');
  }

  get centroSeleccionado() {
    const id = this.centroIdAplicado();
    if (!id || id === 'todos') return null;
    return this.centrosService.centros().find(c => c._id === id) ?? null;
  }

  get proyectoSeleccionado() {
    const id = this.proyectoIdAplicado();
    if (!id || id === 'todos') return null;
    return this.proyectosService.proyectos().find(p => p._id === id) ?? null;
  }

  formatFecha(fecha?: string): string {
    if (!fecha) return '—';
    const d = new Date(fecha);
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${meses[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  protected readonly formatFechaHora = formatFechaHora;

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
    const centroId = this.solicitudCentroId();
    if (!centroId) return [];
    const all = this.solicitudesService.solicitudes().filter(s => s.estado !== 'aprobado');
    const sols = centroId === 'todos'
      ? all.filter(s => s.centro_costo_id && !s.proyecto_id)
      : all.filter(s => s.centro_costo_id === centroId && !s.proyecto_id);
    return this.filtrarSolicitudes(sols, this.busquedaCentro());
  });

  protected solicitudesDeProyecto = computed(() => {
    const centroId   = this.solicitudCentroId();
    const proyectoId = this.solicitudProyectoId();
    if (!centroId || !proyectoId) return [];
    const all = this.solicitudesService.solicitudes().filter(s => s.estado !== 'aprobado');
    let sols: Solicitud[];
    if (proyectoId === 'todos') {
      if (centroId === 'todos') {
        sols = all.filter(s => !!s.proyecto_id);
      } else {
        const ids = this.proyectosService.proyectos()
          .filter(p => (p.centro_costo_ids ?? []).some(id => asId(id) === centroId))
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

  get proyectosParaSolicitudesC() {
    const empresa = this.consumidorContext.empresaSeleccionada();
    const centroId = this.solicitudCentroId();
    if (!empresa || !centroId || centroId === 'todos') return [];
    return this.proyectosService.proyectos().filter(p =>
      asId(p.cliente_id) === asId(empresa._id) && (p.centro_costo_ids ?? []).some(id => asId(id) === centroId)
    );
  }

  protected busquedaSolicitudActual = computed(() => {
    if (!this.solicitudCentroId() || this.solicitudCentroId() === 'todos') return this.busquedaEmpresa();
    if (this.solicitudProyectoId() && this.solicitudProyectoId() !== 'todos') return this.busquedaProyecto();
    return this.busquedaCentro();
  });

  onBusquedaSolicitudChange(value: string): void {
    if (!this.solicitudCentroId() || this.solicitudCentroId() === 'todos') { this.busquedaEmpresa.set(value); return; }
    if (this.solicitudProyectoId() && this.solicitudProyectoId() !== 'todos') { this.busquedaProyecto.set(value); return; }
    this.busquedaCentro.set(value);
  }

  seleccionarSolicitudAmbito(ambito: string): void {
    this.solicitudAmbito.set(ambito as 'empresa' | 'centro' | 'proyecto');
    this.onSolicitudCentroChange('todos');
  }

  onSolicitudCentroChange(id: string): void {
    this.solicitudCentroId.set(id);
    this.solicitudProyectoId.set('todos');
  }

  onSolicitudProyectoChange(id: string): void {
    this.solicitudProyectoId.set(id);
  }

  // ─── lifecycle ────────────────────────────────────────────────────────────

  constructor() {
    effect(() => {
      const empresa = this.consumidorContext.empresaSeleccionada();
      this.solicitudCentroId.set('todos');
      this.solicitudProyectoId.set('todos');
      this.centroIdPendiente.set('todos');
      this.proyectoIdPendiente.set('todos');
      this.actividadIdPendiente.set('todos');
      this.activoIdPendiente.set('todos');
      this.centroIdAplicado.set('todos');
      this.proyectoIdAplicado.set('todos');
      this.actividadIdAplicado.set('todos');
      this.activoIdAplicado.set('todos');
      this.estadoPendiente.set('activos');
      this.estadoAplicado.set('activos');
      this.service.documentosVencidos.set([]);
      this.filasActividad.set([]);
      this.filasActivo.set([]);
      if (empresa) {
        this.service.documentosCentro.set([]);
        this.service.documentosProyecto.set([]);
        this.service.documentosPorCentro.set([]);
        this.service.cargarEmpresa(empresa._id);
        this.solicitudesService.cargar(empresa._id);
        untracked(() => {
          this.proyectosService.cargarPorEmpresa(empresa._id);
          this.actividadesService.cargarPorEmpresa(empresa._id);
        });
      } else {
        this.service.documentosEmpresa.set([]);
        this.solicitudesService.cargar('');
      }
    });

    // Activos se carga por centro (no hay endpoint "por empresa" para activos) —
    // se reintenta cuando la lista de centros de la empresa está lista.
    effect(() => {
      const empresa = this.consumidorContext.empresaSeleccionada();
      const centros = this.centrosFiltradosCSig();
      if (empresa && centros.length > 0) {
        untracked(() => this.activosService.cargarPorCentros(empresa._id, centros.map(c => c._id)));
      } else if (empresa) {
        untracked(() => this.activosService.activos.set([]));
      }
    });

    effect(() => {
      const centros   = this.centrosFiltradosCSig();
      const centroId  = this._pendingCentroId();
      if (!centroId || centros.length === 0) return;
      const proyectoId = this._pendingProyectoId();
      this._pendingCentroId.set(null);
      this._pendingProyectoId.set(null);
      untracked(() => this.activarDesdeQueryParams(centroId, proyectoId ?? undefined));
    });

    // cargarTodosCentros/cargarTodosProyectos reciben la lista de centros/proyectos
    // como snapshot no-reactivo. Si se llaman antes de que CentrosService/
    // ProyectosService terminen su GET, el snapshot llega vacío — este efecto
    // reintenta la carga de "Centro: todos" cuando la selección aplicada lo pide.
    effect(() => {
      const empresa = this.consumidorContext.empresaSeleccionada();
      const grupo = this.grupoAplicado();
      const centroId = this.centroIdAplicado();
      const centros = this.centrosFiltradosC;
      if (empresa && grupo === 'centro' && centroId === 'todos' && centros.length > 0) {
        untracked(() => this.service.cargarTodosCentros(empresa._id, centros));
      }
    });

    effect(() => {
      const empresa = this.consumidorContext.empresaSeleccionada();
      const grupo = this.grupoAplicado();
      const centroId = this.centroIdAplicado();
      const proyectoId = this.proyectoIdAplicado();
      if (!empresa || grupo !== 'proyecto' || proyectoId !== 'todos') return;
      const proyectos = centroId !== 'todos'
        ? this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === asId(empresa._id) && (p.centro_costo_ids ?? []).some(id => asId(id) === centroId))
        : this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === asId(empresa._id));
      if (proyectos.length > 0) {
        untracked(() => this.service.cargarTodosProyectos(empresa._id, proyectos, this.centrosFiltradosC));
      }
    });
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const tab        = params.get('tab') as 'documentacion' | 'solicitudes' | null;
    const centroId   = params.get('centroId');
    const proyectoId = params.get('proyectoId');
    if (tab) this.tabConsumidorActiva.set(tab);
    if (centroId) {
      this._pendingCentroId.set(centroId);
      if (proyectoId) this._pendingProyectoId.set(proyectoId);
    }
    if (!centroId && !proyectoId && tab === 'solicitudes') {
      this.solicitudCentroId.set('todos');
    }
  }

  // ─── consumidor handlers ──────────────────────────────────────────────────

  // Llegada directa desde otra página (p.ej. "Ver documentos" en el detalle de un
  // centro/proyecto) — activa el grupo correspondiente y dispara la búsqueda de
  // inmediato, sin esperar un clic en "Buscar" (es una navegación explícita del
  // usuario, no un ajuste de filtro en curso).
  private activarDesdeQueryParams(centroId: string, proyectoId?: string): void {
    const grupo: Grupo = proyectoId ? 'proyecto' : 'centro';
    this.grupoPendiente.set(grupo);
    this.centroIdPendiente.set(centroId);
    this.proyectoIdPendiente.set(proyectoId ?? 'todos');
    this.aplicarFiltros();
  }

  onCentroChangePendiente(id: string): void {
    this.centroIdPendiente.set(id);
    this.proyectoIdPendiente.set('todos');
    this.actividadIdPendiente.set('todos');
    this.activoIdPendiente.set('todos');
  }

  seleccionarGrupoPendiente(grupo: string): void {
    this.grupoPendiente.set(grupo as Grupo);
  }

  // ─── Buscar / Limpiar — aplican todo el filtro pendiente de una vez ────────

  aplicarFiltros(): void {
    this.grupoAplicado.set(this.grupoPendiente());
    this.centroIdAplicado.set(this.centroIdPendiente());
    this.proyectoIdAplicado.set(this.proyectoIdPendiente());
    this.actividadIdAplicado.set(this.actividadIdPendiente());
    this.activoIdAplicado.set(this.activoIdPendiente());
    this.categoriasAplicado.set([...this.categoriasPendiente()]);
    this.busquedaAplicada.set(this.busquedaPendiente());
    this.estadoAplicado.set(this.estadoPendiente());
    this.ordenAplicado.set(this.ordenPendiente());
    this.tabConsumidorActiva.set('documentacion');
    this.categoriaMenuAbierto.set(null);
    this.ejecutarBusqueda();
  }

  limpiarFiltros(): void {
    this.grupoPendiente.set('empresa');
    this.centroIdPendiente.set('todos');
    this.proyectoIdPendiente.set('todos');
    this.actividadIdPendiente.set('todos');
    this.activoIdPendiente.set('todos');
    this.categoriasPendiente.set([]);
    this.busquedaPendiente.set('');
    this.estadoPendiente.set('activos');
    this.ordenPendiente.set('alfabetico');
    this.aplicarFiltros();
  }

  private ejecutarBusqueda(): void {
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) return;
    const grupo = this.grupoAplicado();
    this.service.documentosVencidos.set([]);

    if (this.estadoAplicado() === 'vencidos' && (grupo === 'empresa' || grupo === 'centro' || grupo === 'proyecto')) {
      this.cargarVencidosConsumidor();
      return;
    }

    if (grupo === 'empresa') {
      this.service.cargarEmpresa(empresa._id);
    } else if (grupo === 'centro') {
      const id = this.centroIdAplicado();
      if (id === 'todos') {
        this.service.documentosCentro.set([]);
        this.service.cargarTodosCentros(empresa._id, this.centrosFiltradosC);
      } else if (id) {
        this.service.documentosPorCentro.set([]);
        this.service.cargar('centro', empresa._id, id);
      }
    } else if (grupo === 'proyecto') {
      const centroId   = this.centroIdAplicado();
      const proyectoId = this.proyectoIdAplicado();
      this.service.documentosProyecto.set([]);
      this.service.documentosPorProyecto.set([]);
      if (proyectoId === 'todos' && centroId === 'todos') {
        const todosProyectos = this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === asId(empresa._id));
        this.service.cargarTodosProyectos(empresa._id, todosProyectos, this.centrosFiltradosC);
      } else if (proyectoId === 'todos' && centroId && centroId !== 'todos') {
        const proyectosDeCentro = this.proyectosService.proyectos().filter(
          p => asId(p.cliente_id) === asId(empresa._id) && (p.centro_costo_ids ?? []).some(cid => asId(cid) === centroId)
        );
        this.service.cargarTodosProyectos(empresa._id, proyectosDeCentro, this.centrosFiltradosC);
      } else if (proyectoId && proyectoId !== 'todos' && centroId && centroId !== 'todos') {
        this.service.cargar('proyecto', empresa._id, centroId, proyectoId);
      }
    } else if (grupo === 'actividad') {
      this.ejecutarBusquedaActividad();
    } else if (grupo === 'activo') {
      this.ejecutarBusquedaActivo();
    }

    if (empresa) this.solicitudesService.cargar(empresa._id);
  }

  private aplicarFiltrosDocs<T extends { nombre_display: string; categoria?: string; subido_en?: string }>(docs: T[]): T[] {
    const categorias = this.categoriasAplicado();
    const term = this.busquedaAplicada().trim().toLowerCase();
    const filtrados = docs
      .filter(d => !categorias.length || categorias.includes(d.categoria ?? ''))
      .filter(d => !term || d.nombre_display.toLowerCase().includes(term));
    return ordenarPorDocumento(filtrados, this.ordenAplicado(), d => d);
  }

  private ejecutarBusquedaActividad(): void {
    const centroId = this.centroIdAplicado();
    const actividadId = this.actividadIdAplicado();
    let actividades = this.actividadesService.actividades();
    if (centroId !== 'todos') actividades = actividades.filter(a => asId(a.centro_costo_id) === centroId);
    if (actividadId !== 'todos') actividades = actividades.filter(a => a._id === actividadId);
    if (!actividades.length) { this.filasActividad.set([]); return; }

    this.cargandoGrupo.set(true);
    forkJoin(actividades.map(a => this.actividadesService.listarDocumentosObs(a._id))).subscribe(resultados => {
      this.cargandoGrupo.set(false);
      const centroMap = new Map(this.centrosService.centros().map(c => [asId(c._id), c.nombre]));
      this.filasActividad.set(
        actividades
          .map((a, i) => ({
            nombre: a.nombre,
            id: a._id,
            meta: centroMap.get(asId(a.centro_costo_id)),
            docs: this.aplicarFiltrosDocs(resultados[i]),
          }))
          .filter(f => f.docs.length > 0)
      );
    });
  }

  private ejecutarBusquedaActivo(): void {
    const centroId = this.centroIdAplicado();
    const activoId = this.activoIdAplicado();
    let activos = this.activosService.activos();
    if (centroId !== 'todos') activos = activos.filter(a => asId(a.centro_costo_id) === centroId);
    if (activoId !== 'todos') activos = activos.filter(a => a._id === activoId);
    if (!activos.length) { this.filasActivo.set([]); return; }

    this.cargandoGrupo.set(true);
    forkJoin(activos.map(a => this.activosService.listarDocumentosObs(a._id, asId(a.centro_costo_id)))).subscribe(resultados => {
      this.cargandoGrupo.set(false);
      const centroMap = new Map(this.centrosService.centros().map(c => [asId(c._id), c.nombre]));
      this.filasActivo.set(
        activos
          .map((a, i) => ({
            nombre: a.nombre,
            id: a._id,
            centroId: asId(a.centro_costo_id),
            meta: centroMap.get(asId(a.centro_costo_id)),
            docs: this.aplicarFiltrosDocs(resultados[i]),
          }))
          .filter(f => f.docs.length > 0)
      );
    });
  }

  onBusquedaNombreChange(valor: string): void {
    this.busquedaPendiente.set(valor);
  }

  eliminarActividadDoc(actividadId: string, docId: string): void {
    if (!confirmarEliminacion('este documento')) return;
    this.actividadesService.eliminarDocumento(actividadId, docId, () => this.ejecutarBusquedaActividad());
  }

  actualizarCategoriaActividadDoc(actividadId: string, docId: string, categoria: string): void {
    this.categoriaMenuAbierto.set(null);
    this.actividadesService.actualizarCategoria(actividadId, docId, categoria, () => this.ejecutarBusquedaActividad());
  }

  eliminarActivoDoc(activoId: string, centroId: string, docId: string): void {
    if (!confirmarEliminacion('este documento')) return;
    this.activosService.eliminarDocumento(activoId, centroId, docId, () => this.ejecutarBusquedaActivo());
  }

  actualizarCategoriaActivoDoc(activoId: string, centroId: string, docId: string, categoria: string): void {
    this.categoriaMenuAbierto.set(null);
    this.activosService.actualizarCategoria(activoId, centroId, docId, categoria, () => this.ejecutarBusquedaActivo());
  }

  descargarActividadDoc(actividadId: string, docId: string, nombreDisplay: string): void {
    this.actividadesService.descargarDocumento(actividadId, docId, nombreDisplay);
  }

  descargarActivoDoc(activoId: string, centroId: string, docId: string, nombreDisplay: string): void {
    this.activosService.descargarDocumento(activoId, centroId, docId, nombreDisplay);
  }

  marcarVencidoConsumidor(docUrl: string, tipo: DocTipo): void {
    const empresaId = asId(this.consumidorContext.empresaSeleccionada()?._id) ?? '';
    const centroId   = this.centroIdAplicado()   !== 'todos' ? this.centroIdAplicado()   : undefined;
    const proyectoId = this.proyectoIdAplicado() !== 'todos' ? this.proyectoIdAplicado() : undefined;
    this.service.marcarVencido(docUrl, tipo, empresaId, centroId, proyectoId, undefined, undefined, undefined, undefined, () => this.ejecutarBusqueda());
  }

  // ─── modal "Subir documentos" ─────────────────────────────────────────────

  abrirModalSubida(): void {
    this.uploadDestinoTipo.set('empresa');
    this.uploadCentroId.set('');
    this.uploadProyectoId.set('');
    this.uploadActividadId.set('');
    this.uploadActivoId.set('');
    this.uploadModoUpload.set('archivo');
    this.uploadLinkInput = '';
    this.uploadNombreInput = '';
    this.uploadCategoriaInput = 'Contratos';
    this.uploadModalAbierto.set(true);
  }

  cerrarModalSubida(): void {
    this.uploadModalAbierto.set(false);
    this.uploadQueue.items()
      .filter(i => i.kind === 'archivo' && this.retryContext.has(i.id))
      .forEach(i => { this.uploadQueue.quitar(i.id); this.retryContext.delete(i.id); });
  }

  seleccionarDestinoTipo(tipo: string): void {
    this.uploadDestinoTipo.set(tipo as DestinoTipo);
    this.uploadCentroId.set('');
    this.uploadProyectoId.set('');
    this.uploadActividadId.set('');
    this.uploadActivoId.set('');
  }

  onUploadCentroChange(id: string): void {
    this.uploadCentroId.set(id);
    this.uploadProyectoId.set('');
    this.uploadActividadId.set('');
    this.uploadActivoId.set('');
  }

  private resolverDestinoModal(): Pick<ModalUploadCtx, 'destinoTipo' | 'empresaId' | 'centroId' | 'proyectoId' | 'actividadId' | 'activoId'> | null {
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) return null;
    const t = this.uploadDestinoTipo();
    const empresaId = empresa._id;
    if (t === 'empresa') return { destinoTipo: t, empresaId };
    if (t === 'centro') return this.uploadCentroId() ? { destinoTipo: t, empresaId, centroId: this.uploadCentroId() } : null;
    if (t === 'proyecto') return (this.uploadCentroId() && this.uploadProyectoId()) ? { destinoTipo: t, empresaId, centroId: this.uploadCentroId(), proyectoId: this.uploadProyectoId() } : null;
    if (t === 'actividad') return (this.uploadCentroId() && this.uploadActividadId()) ? { destinoTipo: t, empresaId, centroId: this.uploadCentroId(), actividadId: this.uploadActividadId() } : null;
    return (this.uploadCentroId() && this.uploadActivoId()) ? { destinoTipo: t, empresaId, centroId: this.uploadCentroId(), activoId: this.uploadActivoId() } : null;
  }

  linkInvalidoModal(): boolean {
    const link = this.uploadLinkInput.trim();
    if (!link) return false;
    return !/^https?:\/\/.+/i.test(link);
  }

  onArchivoChangeModal(file: File | null): void {
    if (!file) return;
    const destino = this.resolverDestinoModal();
    if (!destino) return;
    const categoria = detectarCategoriaDocumento(file.name) ?? 'Otros';
    const id = this.uploadQueue.agregar(file.name, 'archivo', categoria);
    const ctx: ModalUploadCtx = { kind: 'archivo', file, ...destino, categoria };
    this.retryContext.set(id, ctx);
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      this.uploadQueue.marcarError(id, `El archivo pesa ${formatBytes(file.size)} y supera el límite de 20 MB. Selecciona uno más liviano.`);
      return;
    }
    this.ejecutarSubidaModal(id, ctx);
  }

  tarjetasSubidaModal(): DocumentoTarjeta[] {
    return this.uploadQueue.items()
      .filter(i => i.kind === 'archivo' && this.retryContext.has(i.id))
      .map(i => ({
        id: i.id,
        nombre: i.nombre,
        tipoContenido: 'archivo' as const,
        estado: i.estado,
        categoria: i.categoria,
        errorMsg: i.errorMsg,
      }));
  }

  onCategoriaTarjetaChangeModal(event: { id: string; categoria: string }): void {
    this.uploadQueue.actualizarCategoria(event.id, event.categoria);
    const item = this.uploadQueue.items().find(i => i.id === event.id);
    const ctx = this.retryContext.get(event.id);
    if (item?.estado === 'listo' && item.docUrl && ctx && (ctx.destinoTipo === 'empresa' || ctx.destinoTipo === 'centro' || ctx.destinoTipo === 'proyecto')) {
      this.service.actualizarCategoria(item.docUrl, event.categoria, ctx.destinoTipo);
    }
  }

  onRenombrarTarjetaModal(event: { id: string; nuevoNombre: string }): void {
    const item = this.uploadQueue.items().find(i => i.id === event.id);
    const ctx = this.retryContext.get(event.id);
    if (item?.estado === 'listo' && item.docUrl && ctx && (ctx.destinoTipo === 'empresa' || ctx.destinoTipo === 'centro' || ctx.destinoTipo === 'proyecto')) {
      this.service.renombrarDocumento(item.docUrl, event.nuevoNombre, ctx.destinoTipo,
        () => this.uploadQueue.actualizarNombre(event.id, event.nuevoNombre));
    }
  }

  onEliminarTarjetaModal(id: string): void {
    const item = this.uploadQueue.items().find(i => i.id === id);
    const ctx = this.retryContext.get(id);
    if (item?.estado === 'listo' && item.docUrl && ctx && (ctx.destinoTipo === 'empresa' || ctx.destinoTipo === 'centro' || ctx.destinoTipo === 'proyecto')) {
      if (!confirmarEliminacion(item.nombre ?? 'este documento')) return;
      this.service.eliminar(item.docUrl, ctx.destinoTipo, ctx.empresaId, ctx.centroId, ctx.proyectoId,
        () => { this.uploadQueue.quitar(id); this.retryContext.delete(id); this.ejecutarBusqueda(); });
      return;
    }
    if (item?.estado === 'listo') return; // actividad/activo ya subidos: se gestionan desde su propia pestaña.
    this.uploadQueue.quitar(id);
    this.retryContext.delete(id);
  }

  confirmarSubidaLinkModal(): void {
    const destino = this.resolverDestinoModal();
    if (!destino) return;
    const link = this.uploadLinkInput.trim();
    if (!link || this.linkInvalidoModal()) return;
    const ctx: ModalUploadCtx = { kind: 'link', linkUrl: link, ...destino, nombreDisplay: this.uploadNombreInput || undefined, categoria: this.uploadCategoriaInput || undefined };
    const nombreParaCola = this.uploadNombreInput || link;

    const id = this.uploadQueue.agregar(nombreParaCola, 'link', ctx.categoria);
    this.retryContext.set(id, ctx);
    this.ejecutarSubidaModal(id, ctx);

    this.uploadNombreInput = '';
    this.uploadLinkInput = '';
  }

  reintentarSubida(id: string): void {
    const ctx = this.retryContext.get(id);
    if (!ctx) return;
    this.uploadQueue.reiniciar(id);
    this.ejecutarSubidaModal(id, ctx);
  }

  cerrarUploadBubble(): void {
    this.uploadQueue.items()
      .filter(i => i.kind === 'link')
      .forEach(i => { this.uploadQueue.quitar(i.id); this.retryContext.delete(i.id); });
  }

  itemsLinkParaBurbuja() {
    return this.uploadQueue.items().filter(i => i.kind === 'link');
  }

  private ejecutarSubidaModal(id: string, ctx: ModalUploadCtx): void {
    const onError = (err?: any) => {
      if (err?.status === 413) {
        this.uploadQueue.marcarError(id, 'El archivo supera el límite de 20MB.');
        return;
      }
      const raw = err?.error?.message;
      const text = Array.isArray(raw) ? raw.join('. ') : (raw ?? err?.message ?? 'Error al cargar');
      this.uploadQueue.marcarError(id, text);
    };

    if (ctx.destinoTipo === 'actividad') {
      if (ctx.kind === 'link') {
        this.actividadesService.subirDocumentoLink(ctx.actividadId!, ctx.linkUrl!, ctx.nombreDisplay,
          () => this.uploadQueue.marcarListo(id), onError, ctx.categoria);
      } else {
        this.actividadesService.subirDocumento(ctx.actividadId!, ctx.file!, ctx.nombreDisplay,
          () => this.uploadQueue.marcarListo(id), onError, ctx.categoria);
      }
      return;
    }

    if (ctx.destinoTipo === 'activo') {
      if (ctx.kind === 'link') {
        this.activosService.subirDocumentoLink(ctx.activoId!, ctx.centroId!, ctx.linkUrl!, ctx.nombreDisplay,
          () => this.uploadQueue.marcarListo(id), onError, ctx.categoria);
      } else {
        this.activosService.subirDocumento(ctx.activoId!, ctx.centroId!, ctx.file!, ctx.nombreDisplay,
          () => this.uploadQueue.marcarListo(id), onError, ctx.categoria);
      }
      return;
    }

    const tipo = ctx.destinoTipo; // 'empresa' | 'centro' | 'proyecto'
    if (ctx.kind === 'link') {
      this.service.subirLink(ctx.linkUrl!, tipo, ctx.empresaId, ctx.centroId, ctx.proyectoId, ctx.nombreDisplay, ctx.categoria)
        .subscribe({
          next: () => { this.uploadQueue.marcarListo(id); this.retryContext.delete(id); },
          error: onError,
        });
      return;
    }

    this.service.subir(ctx.file!, tipo, ctx.empresaId, ctx.centroId, ctx.proyectoId, ctx.nombreDisplay, ctx.categoria)
      .subscribe({
        next: (event: HttpEvent<DocumentoItem>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadQueue.actualizarProgreso(id, Math.round((100 * event.loaded) / event.total));
          } else if (event.type === HttpEventType.Response) {
            const docUrl = event.body?._id
              ? this.service.docUrl(tipo, event.body._id, ctx.empresaId, ctx.centroId, ctx.proyectoId)
              : undefined;
            this.uploadQueue.marcarListo(id, docUrl);
            if (docUrl) {
              const item = this.uploadQueue.items().find(i => i.id === id);
              if (item?.categoria && item.categoria !== ctx.categoria) {
                this.service.actualizarCategoria(docUrl, item.categoria, tipo);
              }
            }
          }
        },
        error: onError,
      });
  }

  toggleFiltroCategoriaPendiente(categoria: string): void {
    const actuales = this.categoriasPendiente();
    this.categoriasPendiente.set(
      actuales.includes(categoria) ? actuales.filter(c => c !== categoria) : [...actuales, categoria]
    );
  }

  isFiltroCategoriaPendienteSelected(categoria: string): boolean {
    return this.categoriasPendiente().includes(categoria);
  }

  toggleDropdownTipo(): void {
    this.dropdownTipoAbierto.update(v => !v);
  }

  categoriaTag(cat: string): string | null {
    return cat.match(/^\[([^\]]+)\]/)?.[1] ?? null;
  }

  categoriaResto(cat: string): string {
    return cat.replace(/^\[[^\]]+\]\s*/, '');
  }

  filteredDocsPorCentro() {
    return this.service.documentosPorCentro()
      .map(item => ({ ...item, docs: this.aplicarFiltrosDocs(item.docs) }))
      .filter(item => item.docs.length > 0);
  }

  filteredDocsPorProyecto() {
    return this.service.documentosPorProyecto()
      .map(item => ({ ...item, docs: this.aplicarFiltrosDocs(item.docs) }))
      .filter(item => item.docs.length > 0);
  }

  docsFiltrados(tipo: DocTipo): DocumentoItem[] {
    const docs = tipo === 'empresa' ? this.service.documentosEmpresa()
      : tipo === 'centro' ? this.service.documentosCentro()
      : this.service.documentosProyecto();
    return this.aplicarFiltrosDocs(docs);
  }

  eliminar(docUrl: string, tipo: DocTipo, nombre?: string): void {
    if (nombre !== undefined && !confirmarEliminacion(nombre)) return;
    const empresaId = asId(this.consumidorContext.empresaSeleccionada()?._id) ?? '';
    const centroId = this.centroIdAplicado() !== 'todos' ? this.centroIdAplicado() : undefined;
    const proyectoId = this.proyectoIdAplicado() !== 'todos' ? this.proyectoIdAplicado() : undefined;
    this.service.eliminar(docUrl, tipo, empresaId, centroId, proyectoId, () => this.ejecutarBusqueda());
  }

  protected categoriaMenuAbierto = signal<string | null>(null);

  toggleCategoriaMenu(docId: string): void {
    this.categoriaMenuAbierto.update(actual => actual === docId ? null : docId);
  }

  seleccionarCategoriaC(docUrl: string, categoria: string, tipo: DocTipo): void {
    this.categoriaMenuAbierto.set(null);
    this.service.actualizarCategoria(docUrl, categoria, tipo, () => this.ejecutarBusqueda());
  }

  abrirDocumento(d: { tipo_contenido?: 'archivo' | 'link'; link_url?: string; url: string; nombre_display: string }): void {
    if (d.tipo_contenido === 'link' && d.link_url) window.open(d.link_url, '_blank', 'noopener');
    else this.service.descargar(d.url, d.nombre_display);
  }

  // ─── helpers unificados para búsqueda de solicitudes ────────────────────

  limpiarBuscadorSolicitudes(): void {
    this.busquedaEmpresa.set('');
    this.busquedaCentro.set('');
    this.busquedaProyecto.set('');
    this.filtroTipoSolicitud.set('');
    this.filtroEstado.set('');
  }

  // ─── solicitudes (consumidor) ─────────────────────────────────────────────

  abrirAdjuntar(id: string): void {
    this.solicitudAdjuntando.set(id);
    this.adjuntoFile = null;
    this.adjuntoLinkInput = '';
    this.adjuntoModo.set('archivo');
    this.solicitudesService.clearStatus();
  }

  setAdjuntoModo(modo: 'archivo' | 'link'): void {
    if (this.adjuntoModo() === modo) return;
    this.adjuntoModo.set(modo);
    this.adjuntoFile = null;
    this.adjuntoLinkInput = '';
  }

  adjuntoLinkInvalido(): boolean {
    const link = this.adjuntoLinkInput.trim();
    if (!link) return false;
    return !/^https?:\/\/.+/i.test(link);
  }

  abrirLinkSolicitud(url: string): void {
    window.open(url, '_blank');
  }

  onAdjuntoChange(file: File | null): void {
    this.adjuntoFile = file;
  }

  adjuntoDemasiadoGrande(): boolean {
    return !!this.adjuntoFile && this.adjuntoFile.size > MAX_UPLOAD_SIZE_BYTES;
  }

  mensajeAdjuntoDemasiadoGrande(): string {
    if (!this.adjuntoFile) return '';
    return `El archivo pesa ${formatBytes(this.adjuntoFile.size)} y supera el límite de 20 MB. Selecciona uno más liviano.`;
  }

  confirmarAdjunto(): void {
    const id = this.solicitudAdjuntando();
    if (!id || this.adjuntando()) return;

    const onSuccess = () => {
      this.adjuntando.set(false);
      this.adjuntoFile = null;
      this.adjuntoLinkInput = '';
      this.solicitudAdjuntando.set(null);
    };
    const onError = () => { this.adjuntando.set(false); };

    if (this.adjuntoModo() === 'link') {
      const link = this.adjuntoLinkInput.trim();
      if (!link || this.adjuntoLinkInvalido()) return;
      this.adjuntando.set(true);
      this.solicitudesService.adjuntarLink(id, link, onSuccess, onError);
    } else {
      if (!this.adjuntoFile || this.adjuntoDemasiadoGrande()) return;
      this.adjuntando.set(true);
      this.solicitudesService.adjuntar(id, this.adjuntoFile, onSuccess, onError);
    }
  }

  estadoChipStyle(estado: EstadoSolicitud): { color: string; bg: string } {
    const map: Record<EstadoSolicitud, { color: string; bg: string }> = {
      pendiente: { color: 'var(--warn)', bg: 'var(--warn-bg)' },
      revision:  { color: '#1e40af', bg: '#dbeafe' },
      aprobado:  { color: 'var(--ok)', bg: 'var(--ok-bg)' },
      rechazado: { color: 'var(--danger)', bg: 'var(--danger-bg)' },
      vencido:   { color: 'var(--fg-2)', bg: 'var(--bg-2)' },
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

  cargarVencidosConsumidor(): void {
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) return;
    const grupo = this.grupoAplicado();
    const centroId   = grupo !== 'empresa' && this.centroIdAplicado()   && this.centroIdAplicado()   !== 'todos' ? this.centroIdAplicado()   : undefined;
    const proyectoId = grupo === 'proyecto' && this.proyectoIdAplicado() && this.proyectoIdAplicado() !== 'todos' ? this.proyectoIdAplicado() : undefined;
    const tipo: 'empresa' | 'centro' | 'proyecto' = grupo === 'centro' || grupo === 'proyecto' ? grupo : 'empresa';
    this.service.cargarVencidos(empresa._id, centroId, proyectoId, tipo);
  }

}
