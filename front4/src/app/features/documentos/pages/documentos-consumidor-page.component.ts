import { Component, OnInit, inject, signal, computed, effect, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { DocumentosService, DocTipo, CATEGORIAS_DOCUMENTO, DocumentoItem, DocBusquedaItem } from '../documentos.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
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

interface PanelState {
  showUpload: boolean;
  nombreInput: string;
  categoriaInput: string;
  busqueda: string;
  categoriaFiltro: string;
  selectedFile: File | null;
  modoUpload: 'archivo' | 'link';
  linkInput: string;
}

type FiltroTipoC = DocTipo | 'todos';

const collatorNombreC = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

interface FilaDocTodosC {
  tipo: DocTipo;
  centroId?: string;
  centroNombre?: string;
  proyectoId?: string;
  proyectoNombre?: string;
  doc: DocBusquedaItem;
}

// Igual que en admin (documentos-admin-page.component.ts), pero sin nivel
// empresa como criterio de desempate: en consumidor todas las filas son de
// la misma empresa, así que no hace falta compararla.
type OrdenTodosC = 'alfabetico' | 'recientes' | 'nivel_empresa' | 'nivel_centro' | 'nivel_proyecto';

const RANGOS_POR_MODO_C: Record<Exclude<OrdenTodosC, 'alfabetico' | 'recientes'>, DocTipo[]> = {
  nivel_empresa:  ['empresa', 'centro', 'proyecto'],
  nivel_centro:   ['centro', 'proyecto', 'empresa'],
  nivel_proyecto: ['proyecto', 'empresa', 'centro'],
};

function ordenarFilasTodosC(filas: FilaDocTodosC[], modo: OrdenTodosC): FilaDocTodosC[] {
  const resultado = [...filas];
  if (modo === 'alfabetico') {
    resultado.sort((a, b) => collatorNombreC.compare(a.doc.nombre_display, b.doc.nombre_display));
    return resultado;
  }
  if (modo === 'recientes') {
    resultado.sort((a, b) => {
      const da = a.doc.subido_en, db = b.doc.subido_en;
      return (db ? Date.parse(db) : 0) - (da ? Date.parse(da) : 0);
    });
    return resultado;
  }
  const rango = RANGOS_POR_MODO_C[modo];
  resultado.sort((a, b) =>
    (rango.indexOf(a.tipo) - rango.indexOf(b.tipo)) ||
    collatorNombreC.compare(a.centroNombre ?? '', b.centroNombre ?? '') ||
    collatorNombreC.compare(a.proyectoNombre ?? '', b.proyectoNombre ?? '') ||
    collatorNombreC.compare(a.doc.nombre_display, b.doc.nombre_display)
  );
  return resultado;
}

type UploadCtx =
  | { kind: 'archivo'; file: File; tipo: DocTipo; empresaId: string; centroId?: string; proyectoId?: string; nombreDisplay?: string; categoria?: string }
  | { kind: 'link'; linkUrl: string; tipo: DocTipo; empresaId: string; centroId?: string; proyectoId?: string; nombreDisplay?: string; categoria?: string };

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
  protected readonly consumidorContext  = inject(ConsumidorContextService);
  protected readonly solicitudesService = inject(SolicitudesService);
  protected readonly authService          = inject(AuthService);
  private  readonly route                 = inject(ActivatedRoute);

  private _pendingCentroId   = signal<string | null>(null);
  private _pendingProyectoId = signal<string | null>(null);

  protected readonly categorias = CATEGORIAS_DOCUMENTO;

  protected selectedCentroIdC   = signal('todos');
  protected selectedProyectoIdC = signal('todos');
  protected filtroEstado              = signal<EstadoSolicitud | ''>('');
  protected filtroTipoSolicitud       = signal('');
  protected busquedaEmpresa           = signal('');
  protected busquedaCentro            = signal('');
  protected busquedaProyecto          = signal('');
  protected tabConsumidorActiva       = signal<'documentacion' | 'solicitudes'>('documentacion');
  protected tabDocConsumidor          = signal<'activos' | 'vencidos'>('activos');
  protected tabJerarquia              = signal<'todos' | 'empresa' | 'centro' | 'proyecto'>('todos');
  protected ordenTodosC               = signal<OrdenTodosC>('alfabetico');
  protected ordenEmpresaC             = signal<OrdenDocumentos>('alfabetico');
  protected ordenCentroC              = signal<OrdenDocumentos>('alfabetico');
  protected ordenProyectoC            = signal<OrdenDocumentos>('alfabetico');

  protected ordenParaTipoC(tipo: FiltroTipoC) {
    return tipo === 'empresa' ? this.ordenEmpresaC : tipo === 'centro' ? this.ordenCentroC : this.ordenProyectoC;
  }

  private busquedaTodosDebounceTimer?: ReturnType<typeof setTimeout>;

  protected solicitudAdjuntando = signal<string | null>(null);
  protected adjuntoFile: File | null = null;
  protected adjuntoModo = signal<'archivo' | 'link'>('archivo');
  protected adjuntoLinkInput = '';
  protected adjuntando = signal(false);

  protected panels: Record<FiltroTipoC, PanelState> = {
    todos:    this.emptyPanel(),
    empresa:  this.emptyPanel(),
    centro:   this.emptyPanel(),
    proyecto: this.emptyPanel(),
  };

  protected readonly uploadQueue = createUploadQueue();
  private readonly retryContext = new Map<string, UploadCtx>();

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
      asId(p.cliente_id) === asId(empresa._id) && (p.centro_costo_ids ?? []).some(id => asId(id) === centroId)
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

  private seccionDoc(tipo?: DocTipo): 'docEmpresa' | 'docCentro' | 'docProyecto' {
    if (tipo === 'empresa') return 'docEmpresa';
    if (tipo === 'proyecto') return 'docProyecto';
    return 'docCentro';
  }

  protected puedeDoc(tipo: DocTipo | undefined, accion: 'subir' | 'editarCategoria' | 'vencer' | 'eliminar'): boolean {
    return this.authService.tienePermiso(this.seccionDoc(tipo), accion);
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

  // Cascada acotada a la propia empresa del consumidor (ver refrescarBusquedaCascada).
  // Igual que en admin, un Proyecto puede pertenecer a varios centros y aparece
  // repetido (mismo _id) en el árbol — se deduplica manteniendo la primera aparición.
  protected filasTodos = computed<FilaDocTodosC[]>(() => {
    const vistos = new Set<string>();
    const filas: FilaDocTodosC[] = [];
    for (const empresa of this.service.busquedaCascada()) {
      for (const doc of empresa.documentos) {
        if (vistos.has(doc._id)) continue;
        vistos.add(doc._id);
        filas.push({ tipo: 'empresa', doc });
      }
      for (const centro of empresa.centros) {
        for (const doc of centro.documentos) {
          if (vistos.has(doc._id)) continue;
          vistos.add(doc._id);
          filas.push({ tipo: 'centro', centroId: centro._id, centroNombre: centro.nombre, doc });
        }
        for (const proyecto of centro.proyectos) {
          for (const doc of proyecto.documentos) {
            if (vistos.has(doc._id)) continue;
            vistos.add(doc._id);
            filas.push({
              tipo: 'proyecto',
              centroId: proyecto.centro_id, centroNombre: centro.nombre,
              proyectoId: proyecto._id, proyectoNombre: proyecto.nombre,
              doc,
            });
          }
        }
      }
    }
    return ordenarFilasTodosC(filas, this.ordenTodosC());
  });

  // Conteos para los badges de los tabs — total de documentos "en juego" en cada
  // tab con la selección actual, independiente del buscador/categorías de cada panel.
  protected conteoTodos = computed(() => this.filasTodos().length);

  protected conteoEmpresa = computed(() => this.service.documentosEmpresa().length);

  protected conteoCentro = computed(() => {
    if (this.selectedCentroIdC() !== 'todos') return this.service.documentosCentro().length;
    return this.service.documentosPorCentro().reduce((acc, g) => acc + g.docs.length, 0);
  });

  protected conteoProyecto = computed(() => {
    if (this.selectedProyectoIdC() !== 'todos') return this.service.documentosProyecto().length;
    return this.service.documentosPorProyecto().reduce((acc, g) => acc + g.docs.length, 0);
  });

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

  protected busquedaSolicitudActual = computed(() => {
    const jerarquia = this.tabJerarquia();
    if (jerarquia === 'empresa') return this.busquedaEmpresa();
    if (jerarquia === 'centro')  return this.busquedaCentro();
    return this.busquedaProyecto();
  });

  onBusquedaSolicitudChange(value: string): void {
    const jerarquia = this.tabJerarquia();
    if (jerarquia === 'empresa') this.busquedaEmpresa.set(value);
    else if (jerarquia === 'centro') this.busquedaCentro.set(value);
    else this.busquedaProyecto.set(value);
  }

  // ─── lifecycle ────────────────────────────────────────────────────────────

  constructor() {
    effect(() => {
      const empresa = this.consumidorContext.empresaSeleccionada();
      this.selectedCentroIdC.set('todos');
      this.selectedProyectoIdC.set('todos');
      this.tabDocConsumidor.set('activos');
      this.service.documentosVencidos.set([]);
      if (empresa) {
        this.service.documentosCentro.set([]);
        this.service.documentosProyecto.set([]);
        this.service.documentosPorCentro.set([]);
        this.service.cargarEmpresa(empresa._id);
        this.solicitudesService.cargar(empresa._id);
        untracked(() => {
          this.proyectosService.cargarPorEmpresa(empresa._id);
          this.refrescarBusquedaCascada();
        });
      } else {
        this.service.documentosEmpresa.set([]);
        this.solicitudesService.cargar('');
        this.service.busquedaCascada.set([]);
      }
    });

    effect(() => {
      const centros   = this.centrosFiltradosCSig();
      const centroId  = this._pendingCentroId();
      if (!centroId || centros.length === 0) return;
      const proyectoId = this._pendingProyectoId();
      this._pendingCentroId.set(null);
      this._pendingProyectoId.set(null);
      untracked(() => {
        this.onCentroChangeC(centroId);
        if (proyectoId) this.onProyectoChangeC(proyectoId);
      });
    });

    // cargarTodosCentros/cargarTodosProyectos reciben la lista de centros/proyectos
    // como snapshot no-reactivo (this.centrosFiltradosC es un getter plano). Si se
    // llaman antes de que CentrosService/ProyectosService terminen su GET (p.ej. el
    // GET que dispara TopbarComponent), el snapshot llega vacío y nada vuelve a
    // reintentarlo — por eso "Centro"/"Proyecto" en modo "todos" podían quedar vacíos
    // hasta que el usuario tocaba el <select> a mano. Estos efectos reaccionan cuando
    // esas listas cambian y rellenan la carga.
    effect(() => {
      const empresa = this.consumidorContext.empresaSeleccionada();
      const centroId = this.selectedCentroIdC();
      const centros = this.centrosFiltradosC;
      if (empresa && centroId === 'todos' && centros.length > 0) {
        untracked(() => this.service.cargarTodosCentros(empresa._id, centros));
      }
    });

    effect(() => {
      const empresa = this.consumidorContext.empresaSeleccionada();
      const centroId = this.selectedCentroIdC();
      const proyectoId = this.selectedProyectoIdC();
      if (!empresa || proyectoId !== 'todos') return;
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
      this.tabJerarquia.set('centro');
    }
    if (proyectoId) {
      this._pendingProyectoId.set(proyectoId);
      this.tabJerarquia.set('proyecto');
    }
    if (!centroId && !proyectoId && tab === 'solicitudes') {
      this.tabJerarquia.set('empresa');
    }
  }

  // ─── consumidor handlers ──────────────────────────────────────────────────

  onCentroChangeC(id: string): void {
    const estabaEnVencidos = this.tabDocConsumidor() === 'vencidos';
    this.selectedCentroIdC.set(id);
    this.selectedProyectoIdC.set('todos');
    if (!estabaEnVencidos) this.tabDocConsumidor.set('activos');
    this.service.documentosVencidos.set([]);
    if (id) this.tabJerarquia.set('centro');
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
    if (estabaEnVencidos) this.cargarVencidosConsumidor();
  }

  onProyectoChangeC(id: string): void {
    const estabaEnVencidos = this.tabDocConsumidor() === 'vencidos';
    if (!estabaEnVencidos) this.tabDocConsumidor.set('activos');
    this.service.documentosVencidos.set([]);
    this.selectedProyectoIdC.set(id);
    if (id) this.tabJerarquia.set('proyecto');
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
        p => asId(p.cliente_id) === asId(empresa?._id) && (p.centro_costo_ids ?? []).some(cid => asId(cid) === centroId)
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
    if (estabaEnVencidos) this.cargarVencidosConsumidor();
  }

  private recargarDocsC(): void {
    const empresaId  = this.consumidorContext.empresaSeleccionada()?._id;
    const centroId   = this.selectedCentroIdC();
    const proyectoId = this.selectedProyectoIdC();
    const tab = this.tabJerarquia();
    if (!empresaId) return;
    if (tab === 'empresa') {
      this.service.cargarEmpresa(empresaId);
    } else if (tab === 'centro') {
      if (centroId === 'todos') {
        this.service.cargarTodosCentros(empresaId, this.centrosFiltradosC);
      } else if (centroId) {
        this.service.cargar('centro', empresaId, centroId);
      }
    } else if (tab === 'proyecto') {
      const cId = centroId !== 'todos' ? centroId : undefined;
      const pId = proyectoId !== 'todos' ? proyectoId : undefined;
      if (proyectoId === 'todos' && centroId === 'todos') {
        const todos = this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === asId(empresaId));
        this.service.cargarTodosProyectos(empresaId, todos, this.centrosFiltradosC);
      } else if (proyectoId === 'todos' && cId) {
        const delCentro = this.proyectosService.proyectos().filter(
          p => asId(p.cliente_id) === asId(empresaId) && (p.centro_costo_ids ?? []).some(id => asId(id) === cId)
        );
        this.service.cargarTodosProyectos(empresaId, delCentro, this.centrosFiltradosC);
      } else if (pId && cId) {
        this.service.cargar('proyecto', empresaId, cId, pId);
      }
    }
  }

  seleccionarTabJerarquiaC(tab: 'todos' | 'empresa' | 'centro' | 'proyecto'): void {
    this.tabJerarquia.set(tab);
    this.tabConsumidorActiva.set('documentacion');
    this.filtroTipoSolicitud.set('');
    this.filtroEstado.set('');
    if (this.tabDocConsumidor() === 'vencidos') this.cargarVencidosConsumidor();
    this.refrescarBusquedaCascada();
    if (tab === 'centro' || tab === 'proyecto') this.recargarDocsC();
  }

  refrescarBusquedaCascada(): void {
    if (this.tabJerarquia() !== 'todos') return;
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) { this.service.busquedaCascada.set([]); return; }
    const { categoriaFiltro, busqueda } = this.panels['todos'];
    this.service.buscarCascada('empresa', categoriaFiltro ? [categoriaFiltro] : undefined, busqueda, empresa._id);
  }

  onBusquedaNombreChange(tipo: FiltroTipoC, valor: string): void {
    this.panels[tipo].busqueda = valor;
    if (tipo === 'todos') {
      clearTimeout(this.busquedaTodosDebounceTimer);
      this.busquedaTodosDebounceTimer = setTimeout(() => this.refrescarBusquedaCascada(), 300);
      return;
    }
  }

  limpiarFiltroDocTipo(tipo: FiltroTipoC): void {
    if (tipo === 'todos') clearTimeout(this.busquedaTodosDebounceTimer);
    this.panels[tipo].busqueda = '';
    this.panels[tipo].categoriaFiltro = '';
    if (tipo === 'todos') this.refrescarBusquedaCascada();
  }

  eliminarEnTodos(docUrl: string, nombre?: string): void {
    if (nombre !== undefined && !confirmarEliminacion(nombre)) return;
    const empresaId = asId(this.consumidorContext.empresaSeleccionada()?._id) ?? '';
    this.service.eliminar(docUrl, 'empresa', empresaId, undefined, undefined, () => this.refrescarBusquedaCascada());
  }

  marcarVencidoConsumidor(docUrl: string, tipo: DocTipo): void {
    const empresaId = asId(this.consumidorContext.empresaSeleccionada()?._id) ?? '';
    const centroId   = this.selectedCentroIdC()   !== 'todos' ? this.selectedCentroIdC()   : undefined;
    const proyectoId = this.selectedProyectoIdC() !== 'todos' ? this.selectedProyectoIdC() : undefined;
    const onSuccess = this.tabJerarquia() === 'todos' ? () => this.refrescarBusquedaCascada() : undefined;
    this.service.marcarVencido(docUrl, tipo, empresaId, centroId, proyectoId, undefined, undefined, undefined, undefined, onSuccess);
  }

  // ─── upload panels ────────────────────────────────────────────────────────

  toggleUpload(tipo: DocTipo): void {
    const p = this.panels[tipo];
    p.showUpload = !p.showUpload;
    if (!p.showUpload) {
      p.selectedFile = null; p.nombreInput = ''; p.linkInput = ''; p.modoUpload = 'archivo';
      this.uploadQueue.items()
        .filter(i => i.kind === 'archivo' && this.retryContext.get(i.id)?.tipo === tipo)
        .forEach(i => { this.uploadQueue.quitar(i.id); this.retryContext.delete(i.id); });
    }
  }

  seleccionarCategoriaFiltro(tipo: FiltroTipoC, categoria: string): void {
    this.panels[tipo].categoriaFiltro = categoria;
    if (tipo === 'todos') this.refrescarBusquedaCascada();
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
    const empresaId = this.consumidorContext.empresaSeleccionada()?._id ?? '';
    const centroId = this.selectedCentroIdC() || undefined;
    const proyectoId = this.selectedProyectoIdC() || undefined;
    const ctx: UploadCtx = { kind: 'archivo', file, tipo, empresaId, centroId, proyectoId, categoria };
    this.retryContext.set(id, ctx);
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      this.uploadQueue.marcarError(id, `El archivo pesa ${formatBytes(file.size)} y supera el límite de 20 MB. Selecciona uno más liviano.`);
      return;
    }
    this.ejecutarSubida(id, ctx);
  }

  tarjetasArchivoSubiendo(tipo: DocTipo): DocumentoTarjeta[] {
    return this.uploadQueue.items()
      .filter(i => i.kind === 'archivo' && this.retryContext.get(i.id)?.tipo === tipo)
      .map(i => ({
        id: i.id,
        nombre: i.nombre,
        tipoContenido: 'archivo' as const,
        estado: i.estado,
        categoria: i.categoria,
        errorMsg: i.errorMsg,
      }));
  }

  onCategoriaTarjetaChange(event: { id: string; categoria: string }, tipo: DocTipo): void {
    this.uploadQueue.actualizarCategoria(event.id, event.categoria);
    const item = this.uploadQueue.items().find(i => i.id === event.id);
    if (item?.estado === 'listo' && item.docUrl) {
      this.service.actualizarCategoria(item.docUrl, event.categoria, tipo);
    }
  }

  onRenombrarTarjeta(event: { id: string; nuevoNombre: string }, tipo: DocTipo): void {
    const item = this.uploadQueue.items().find(i => i.id === event.id);
    if (item?.estado === 'listo' && item.docUrl) {
      this.service.renombrarDocumento(item.docUrl, event.nuevoNombre, tipo,
        () => this.uploadQueue.actualizarNombre(event.id, event.nuevoNombre));
    }
  }

  onEliminarTarjeta(id: string, tipo: DocTipo): void {
    const item = this.uploadQueue.items().find(i => i.id === id);
    if (item?.estado === 'listo' && item.docUrl) {
      if (!confirmarEliminacion(item.nombre ?? 'este documento')) return;
      const empresaId = this.consumidorContext.empresaSeleccionada()?._id ?? '';
      this.service.eliminar(item.docUrl, tipo, empresaId, this.selectedCentroIdC() || undefined, this.selectedProyectoIdC() || undefined,
        () => { this.uploadQueue.quitar(id); this.retryContext.delete(id); this.recargarDocsC(); });
      return;
    }
    this.uploadQueue.quitar(id);
    this.retryContext.delete(id);
  }

  itemsLinkParaBurbuja() {
    return this.uploadQueue.items().filter(i => i.kind === 'link');
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
    const empresaId = this.consumidorContext.empresaSeleccionada()?._id ?? '';
    const centroId = this.selectedCentroIdC() || undefined;
    const proyectoId = this.selectedProyectoIdC() || undefined;

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
    this.uploadQueue.items()
      .filter(i => i.kind === 'link')
      .forEach(i => { this.uploadQueue.quitar(i.id); this.retryContext.delete(i.id); });
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
            const docUrl = event.body?._id
              ? this.service.docUrl(ctx.tipo, event.body._id, ctx.empresaId, ctx.centroId, ctx.proyectoId)
              : undefined;
            this.uploadQueue.marcarListo(id, docUrl);
            if (docUrl) {
              const item = this.uploadQueue.items().find(i => i.id === id);
              if (item?.categoria && item.categoria !== ctx.categoria) {
                this.service.actualizarCategoria(docUrl, item.categoria, ctx.tipo);
              }
            }
          }
        },
        error: onError,
      });
  }

  filteredDocsPorCentro() {
    const { busqueda, categoriaFiltro } = this.panels['centro'];
    const term = busqueda.trim().toLowerCase();
    const orden = this.ordenCentroC();
    return this.service.documentosPorCentro()
      .map(item => ({
        ...item,
        docs: ordenarPorDocumento(
          item.docs
            .filter(d => !categoriaFiltro || d.categoria === categoriaFiltro)
            .filter(d => !term || d.nombre_display.toLowerCase().includes(term)),
          orden, d => d,
        ),
      }))
      .filter(item => item.docs.length > 0);
  }

  filteredDocsPorProyecto() {
    const { busqueda, categoriaFiltro } = this.panels['proyecto'];
    const term = busqueda.trim().toLowerCase();
    const orden = this.ordenProyectoC();
    return this.service.documentosPorProyecto()
      .map(item => ({
        ...item,
        docs: ordenarPorDocumento(
          item.docs
            .filter(d => !categoriaFiltro || d.categoria === categoriaFiltro)
            .filter(d => !term || d.nombre_display.toLowerCase().includes(term)),
          orden, d => d,
        ),
      }))
      .filter(item => item.docs.length > 0);
  }

  docsFiltrados(tipo: DocTipo): DocumentoItem[] {
    const docs = tipo === 'empresa' ? this.service.documentosEmpresa()
      : tipo === 'centro' ? this.service.documentosCentro()
      : this.service.documentosProyecto();
    const { busqueda, categoriaFiltro } = this.panels[tipo];
    const term = busqueda.trim().toLowerCase();
    const filtrados = docs
      .filter(d => !categoriaFiltro || d.categoria === categoriaFiltro)
      .filter(d => !term || d.nombre_display.toLowerCase().includes(term));
    return ordenarPorDocumento(filtrados, this.ordenParaTipoC(tipo)(), d => d);
  }

  eliminar(docUrl: string, tipo: DocTipo, nombre?: string): void {
    if (nombre !== undefined && !confirmarEliminacion(nombre)) return;
    const empresaId = asId(this.consumidorContext.empresaSeleccionada()?._id) ?? '';
    this.service.eliminar(docUrl, tipo, empresaId, this.selectedCentroIdC() || undefined, this.selectedProyectoIdC() || undefined);
  }

  protected categoriaMenuAbierto = signal<string | null>(null);

  toggleCategoriaMenu(docId: string): void {
    this.categoriaMenuAbierto.update(actual => actual === docId ? null : docId);
  }

  seleccionarCategoriaC(docUrl: string, categoria: string, tipo: DocTipo): void {
    this.categoriaMenuAbierto.set(null);
    this.service.actualizarCategoria(docUrl, categoria, tipo);
  }

  seleccionarCategoriaTodosC(docUrl: string, categoria: string): void {
    this.categoriaMenuAbierto.set(null);
    this.service.actualizarCategoria(docUrl, categoria, 'empresa', () => this.refrescarBusquedaCascada());
  }

  abrirDocumento(d: { tipo_contenido?: 'archivo' | 'link'; link_url?: string; url: string; nombre_display: string }): void {
    if (d.tipo_contenido === 'link' && d.link_url) window.open(d.link_url, '_blank', 'noopener');
    else this.service.descargar(d.url, d.nombre_display);
  }

  // ─── helpers unificados para búsqueda de solicitudes ────────────────────

  limpiarBuscadorSolicitudes(): void {
    if (this.tabJerarquia() === 'empresa') {
      this.busquedaEmpresa.set('');
    } else if (this.tabJerarquia() === 'centro') {
      this.busquedaCentro.set('');
    } else {
      this.busquedaProyecto.set('');
    }
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

  activarTabVencidosConsumidor(): void {
    this.tabDocConsumidor.set('vencidos');
    this.cargarVencidosConsumidor();
  }

  cargarVencidosConsumidor(): void {
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) return;
    const tab = this.tabJerarquia();
    const centroId   = tab !== 'empresa' && this.selectedCentroIdC()   && this.selectedCentroIdC()   !== 'todos' ? this.selectedCentroIdC()   : undefined;
    const proyectoId = tab === 'proyecto' && this.selectedProyectoIdC() && this.selectedProyectoIdC() !== 'todos' ? this.selectedProyectoIdC() : undefined;
    const tipo: 'empresa' | 'centro' | 'proyecto' = tab === 'centro' || tab === 'proyecto' ? tab : 'empresa';
    this.service.cargarVencidos(empresa._id, centroId, proyectoId, tipo);
  }

  // ─── private helpers ─────────────────────────────────────────────────────

  private emptyPanel(): PanelState {
    return { showUpload: false, nombreInput: '', categoriaInput: 'Contratos', busqueda: '', categoriaFiltro: '', selectedFile: null, modoUpload: 'archivo', linkInput: '' };
  }
}
