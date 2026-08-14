import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivosService } from '../activos.service';
import { TiposActivoService } from '../tipos-activo.service';
import { CentrosService } from '../../centros/centros.service';
import { ClientesService } from '../../clientes/clientes.service';
import { AuthService } from '../../auth/auth.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { ActivosFormComponent, DocPendiente } from '../components/activos-form/activos-form.component';
import { ActivosListComponent } from '../components/activos-list/activos-list.component';
import { ActivoIconoComponent } from '../components/activo-icono/activo-icono.component';
import { ActivoRevisarModalComponent } from '../components/activo-revisar-modal/activo-revisar-modal.component';
import { Activo, ActividadHistorialItem, CreateActivoDto, DocActivo, TipoActivo } from '../../../shared/models/activo.model';
import { asId, confirmarEliminacion } from '../../../shared/utils';
import { ICONOS_ACTIVO } from '../activos-icons';
import { esImagenDoc } from '../galeria-fotos.utils';

type ModalMode = 'crear' | 'editar' | 'buscar' | 'tipos' | 'revisar' | null;

interface TipoForm { nombre: string; color: string; icono: string; }
function emptyTipoForm(): TipoForm { return { nombre: '', color: '#0095d6', icono: 'herramienta' }; }

@Component({
  selector: 'app-activos-page',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent, ActivosFormComponent, ActivosListComponent, ActivoIconoComponent, ActivoRevisarModalComponent],
  templateUrl: './activos-page.component.html',
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .page-header h2 { margin: 0; font-size: 1.25rem; font-weight: 700; color: #1f2937; }
    .header-actions { display: flex; gap: .6rem; }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15,23,42,.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1rem;
    }
    .modal {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15,23,42,.18);
      width: 100%;
      max-width: 960px;
      max-height: 90vh;
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
      color: #6b7280;
      padding: 0 .25rem;
    }
    .modal-close:hover { color: #1f2937; }
    .search-input {
      width: 100%;
      padding: .65rem .9rem;
      border-radius: 8px;
      border: 1px solid rgba(34,33,33,.2);
      font-size: .9rem;
      font-family: inherit;
      margin-bottom: 1rem;
      box-sizing: border-box;
    }
    .search-input:focus { outline: none; border-color: #0095d6; }
    .tipos-modal {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      align-items: start;
    }
    .tipos-col-title {
      font-size: .9rem;
      font-weight: 700;
      color: #374151;
      margin: 0 0 .75rem;
    }
    .tipos-empty { color: #9ca3af; font-size: .85rem; margin: .5rem 0; }
    .tipos-list { display: flex; flex-direction: column; gap: 0; max-height: 320px; overflow-y: auto; padding-right: .25rem; }
    .tipo-item {
      display: flex;
      align-items: center;
      gap: .6rem;
      padding: .5rem 0;
      border-bottom: 1px solid rgba(34,33,33,.06);
    }
    .tipo-item:last-child { border-bottom: none; }
    .tipo-texto { flex: 1; min-width: 0; }
    .tipo-nombre { font-size: .85rem; font-weight: 600; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tipo-actions { display: flex; gap: .35rem; flex-shrink: 0; }
    .tipo-input {
      width: 100%;
      padding: .5rem .7rem;
      border: 1px solid rgba(34,33,33,.2);
      border-radius: 8px;
      font-size: .85rem;
      font-family: inherit;
      box-sizing: border-box;
      margin-bottom: .5rem;
    }
    .tipo-input:focus { outline: 2px solid #0095d6; border-color: transparent; }

    /* ── Tipo-combo (context card) ───────────────────────────── */
    .tipo-combo { position: relative; }
    .tipo-combo-input {
      width: 100%; box-sizing: border-box;
      padding: .55rem .75rem; padding-right: 2rem;
      border: 1px solid rgba(34,33,33,.15); border-radius: 8px;
      font-size: .875rem; color: #1f2937; font-family: inherit;
      background: #fff; cursor: text; outline: none;
      transition: border-color .15s;
    }
    .tipo-combo-input:focus { border-color: #0095d6; }
    .tipo-combo-input::placeholder { color: #9ca3af; }
    .tipo-combo-arrow {
      position: absolute; right: .65rem; top: 50%; transform: translateY(-50%);
      pointer-events: none; color: #9ca3af; display: flex; align-items: center;
    }
    .tipo-combo-dropdown {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0;
      background: #fff; border: 1px solid rgba(34,33,33,.15); border-radius: 8px;
      box-shadow: 0 8px 24px rgba(15,23,42,.12); z-index: 200;
      max-height: 200px; overflow-y: auto;
    }
    .tipo-combo-option {
      padding: .5rem .75rem; font-size: .875rem; color: #374151;
      cursor: pointer; display: flex; align-items: center; gap: .5rem;
      transition: background .1s;
    }
    .tipo-combo-option:hover, .tipo-combo-option--active { background: #f0f9ff; color: #0095d6; }
    .tipo-combo-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .tipo-combo-empty { padding: .5rem .75rem; font-size: .83rem; color: #9ca3af; }

  `],
})
export class ActivosPageComponent implements OnInit {
  protected readonly service         = inject(ActivosService);
  protected readonly tiposService    = inject(TiposActivoService);
  protected readonly centrosService  = inject(CentrosService);
  protected readonly clientesService = inject(ClientesService);
  protected readonly authService       = inject(AuthService);

  protected readonly iconosActivo = ICONOS_ACTIVO;

  protected puedeGestionarTipos = computed(() =>
    this.authService.tienePermiso('catalogos', 'crear') ||
    this.authService.tienePermiso('catalogos', 'editar') ||
    this.authService.tienePermiso('catalogos', 'eliminar')
  );

  protected modal            = signal<ModalMode>(null);
  protected busqueda         = signal('');
  protected editingId        = signal<string | null>(null);
  protected activoRevisando  = signal<Activo | null>(null);

  protected docsPendientes: DocPendiente[] = [];

  // ── Contexto ─────────────────────────────────────────────────────────────
  private _selectedEmpresaId   = signal('');
  private _selectedCentroId    = signal('');
  protected _selectedTipoId    = signal('');

  get selectedEmpresaId()            { return this._selectedEmpresaId(); }
  set selectedEmpresaId(v: string)   { this._selectedEmpresaId.set(v); }
  get selectedCentroId()             { return this._selectedCentroId(); }
  set selectedCentroId(v: string)    { this._selectedCentroId.set(v); }
  get selectedTipoId()               { return this._selectedTipoId(); }
  set selectedTipoId(v: string)      { this._selectedTipoId.set(v); }

  protected tipoComboQuery = signal('');
  protected tipoComboOpen  = signal(false);

  protected tipoComboFiltrados = computed(() => {
    const q = this.tipoComboQuery().toLowerCase().trim();
    const tipos = this.tiposService.tipos();
    return q ? tipos.filter(t => t.nombre.toLowerCase().includes(q)) : tipos;
  });

  protected onTipoComboInput(q: string): void {
    this.tipoComboQuery.set(q);
    this._selectedTipoId.set('');
    this.tipoComboOpen.set(true);
  }

  protected selectTipoCombo(t: { _id: string; nombre: string } | null): void {
    this._selectedTipoId.set(t?._id ?? '');
    this.tipoComboQuery.set(t?.nombre ?? '');
    this.tipoComboOpen.set(false);
  }

  protected onTipoComboBlur(): void {
    setTimeout(() => {
      this.tipoComboOpen.set(false);
      if (!this._selectedTipoId()) this.tipoComboQuery.set('');
    }, 150);
  }

  protected centrosFiltrados = computed(() => {
    if (!this._selectedEmpresaId()) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === this._selectedEmpresaId());
  });

  protected activosFiltrados = computed(() => {
    const q      = this.busqueda().toLowerCase().trim();
    const tipo   = this._selectedTipoId();
    const tipoQ  = this.tipoComboQuery().toLowerCase().trim();
    let list = this.service.activos();
    if (tipo) {
      list = list.filter(a => this.tipoDeActivo(a)?._id === tipo);
    } else if (tipoQ) {
      list = list.filter(a => (this.tipoDeActivo(a)?.nombre ?? '').toLowerCase().includes(tipoQ));
    }
    if (q) list = list.filter(a => {
      const t = this.tipoDeActivo(a);
      return a.nombre.toLowerCase().includes(q) || (t?.nombre ?? '').toLowerCase().includes(q);
    });
    return list;
  });

  protected get activoEditando(): Activo | null {
    const id = this.editingId();
    return id ? this.service.activos().find(a => a._id === id) ?? null : null;
  }

  protected get docsExistentes(): DocActivo[] {
    return this.service.documentosActivo();
  }

  constructor() {
    effect(() => {
      if (this.tiposService.status()?.type === 'ok' && this.showTipoForm()) {
        this.cerrarTipoForm();
      }
    });
  }

  ngOnInit(): void {
    this.centrosService.cargar();
    this.clientesService.cargar();
    this.tiposService.cargar();
    this.recargarActivos();
  }

  onEmpresaChange(): void {
    this._selectedCentroId.set('');
    this._selectedTipoId.set('');
    this.recargarActivos();
  }

  onCentroChange(): void {
    this.recargarActivos();
  }

  private recargarActivos(): void {
    const empresaId = this._selectedEmpresaId();
    const centroId  = this._selectedCentroId();
    if (!empresaId) {
      // "Todas" las empresas: sin filtro, trae todos los activos.
      this.service.cargar();
      return;
    }
    if (!centroId) {
      const ids = this.centrosFiltrados().map(c => asId(c._id));
      this.service.cargarPorCentros(empresaId, ids);
      return;
    }
    this.service.cargar(centroId);
  }

  protected tipoDeActivo(a: Activo): TipoActivo | null {
    if (typeof a.tipo_activo_id === 'object') return a.tipo_activo_id as TipoActivo;
    return this.tiposService.tipos().find(t => t._id === (a.tipo_activo_id as string)) ?? null;
  }

  protected abrirCrear(): void {
    this.editingId.set(null);
    this.docsPendientes = [];
    this.subiendoCards.set([]);
    this.eliminandoDocIds.set(new Set());
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.modal.set('crear');
  }

  protected abrirBuscar(): void {
    this.busqueda.set('');
    this.service.clearStatus();
    this.modal.set('buscar');
  }

  protected abrirEditar(activo: Activo): void {
    this.editingId.set(activo._id);
    this.subiendoCards.set([]);
    this.eliminandoDocIds.set(new Set());
    this.service.seleccionar(activo);
    this.service.listarDocumentos(activo._id, activo.centro_costo_id);
    this.modal.set('editar');
  }

  protected abrirRevisar(activo: Activo): void {
    this.activoRevisando.set(activo);
    this.service.cargarHistorial(activo._id, activo.centro_costo_id);
    this.service.listarDocumentos(activo._id, activo.centro_costo_id);
    this.modal.set('revisar');
  }

  protected onActividadAbierta(item: ActividadHistorialItem): void {
    const activo = this.activoRevisando();
    if (!activo) return;
    this.service.listarDocumentosActividad(item._id, activo.centro_costo_id);
  }

  protected cerrar(): void {
    this.modal.set(null);
    this.editingId.set(null);
    this.docsPendientes = [];
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.activoRevisando.set(null);
    this.service.resetHistorial();
    this.service.resetDocumentos();
    this.showTipoForm.set(false);
    this.editingTipoId.set(null);
  }

  protected onDescargarActivoDoc(ev: { docId: string; nombreDisplay?: string }): void {
    const activo = this.activoRevisando();
    if (!activo) return;
    this.service.descargarDocumento(activo._id, activo.centro_costo_id, ev.docId, ev.nombreDisplay);
  }

  protected onDescargarActividadDoc(ev: { actividadId: string; centroId: string; docId: string; nombreDisplay?: string }): void {
    this.service.descargarDocumentoActividad(ev.actividadId, ev.centroId, ev.docId, ev.nombreDisplay);
  }

  protected onCargarImagenActivo(ev: { docId: string }): void {
    const activo = this.activoRevisando();
    if (!activo) return;
    this.service.cargarImagenActivo(activo._id, activo.centro_costo_id, ev.docId);
  }

  protected hayImagenesGaleria(): boolean {
    return this.service.documentosActivo().some(esImagenDoc);
  }

  protected get modalAncho(): string {
    if (this.modal() === 'tipos') return '1000px';
    if (this.modal() === 'revisar' && this.hayImagenesGaleria()) return '1120px';
    if (this.modal() === 'editar') return '960px';
    return '860px';
  }

  protected crear(dto: CreateActivoDto): void {
    this.service.crear(dto, (nuevo) => {
      if (this.docsPendientes.length === 0) { this.cerrar(); return; }
      this.editingId.set(nuevo._id);
      this.subirDocsPendientesSecuencial(nuevo._id, dto.centro_costo_id, 0);
    });
  }

  protected actualizar(dto: CreateActivoDto): void {
    const id = this.service.seleccionado()?._id;
    if (id) this.service.actualizar(id, dto, () => this.cerrar());
  }

  protected eliminar(id: string): void {
    const activo = this.service.activos().find(a => a._id === id);
    if (activo && !confirmarEliminacion(activo.nombre)) return;
    if (activo) this.service.seleccionar(activo);
    this.service.eliminar(id);
  }

  protected editarDesdeBuscar(activo: Activo): void {
    this.service.seleccionar(activo);
    this.editingId.set(activo._id);
    this.subiendoCards.set([]);
    this.eliminandoDocIds.set(new Set());
    this.modal.set('editar');
  }

  protected onDocAgregado(doc: DocPendiente): void {
    this.docsPendientes = [...this.docsPendientes, doc];
  }

  protected onDocQuitado(localId: string): void {
    this.docsPendientes = this.docsPendientes.filter(d => d.localId !== localId);
  }

  protected subiendoCards         = signal<{ id: string; nombre: string }[]>([]);
  protected eliminandoDocIds      = signal<Set<string>>(new Set());

  protected onDocRenombrado(ev: { id: string; nuevoNombre: string }): void {
    const activo = this.activoEditando;
    if (!activo) return;
    this.service.renombrarDocumento(activo._id, activo.centro_costo_id, ev.id, ev.nuevoNombre);
  }

  protected onDocSubido(doc: DocPendiente): void {
    const activo = this.activoEditando;
    if (!activo) return;
    const tempId = `subiendo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.subiendoCards.update(list => [...list, { id: tempId, nombre: doc.nombre }]);
    const limpiar = () => this.subiendoCards.update(list => list.filter(c => c.id !== tempId));
    if (doc.linkUrl) {
      this.service.subirDocumentoLink(activo._id, activo.centro_costo_id, doc.linkUrl, doc.nombre, limpiar, limpiar);
    } else if (doc.file) {
      this.service.subirDocumento(activo._id, activo.centro_costo_id, doc.file, doc.nombre, limpiar, limpiar);
    }
  }

  protected onDocEliminado(docId: string): void {
    const activo = this.activoEditando;
    if (!activo) return;
    const nombre = this.service.documentosActivo().find(d => d._id === docId)?.nombre_display;
    if (!confirmarEliminacion(nombre ?? 'este documento')) return;
    this.eliminandoDocIds.update(set => new Set(set).add(docId));
    const limpiar = () => this.eliminandoDocIds.update(set => {
      const copia = new Set(set);
      copia.delete(docId);
      return copia;
    });
    this.service.eliminarDocumento(activo._id, activo.centro_costo_id, docId, limpiar, limpiar);
  }

  protected onDocDescargado(ev: { docId: string; nombreDisplay?: string }): void {
    const activo = this.activoEditando;
    if (!activo) return;
    this.service.descargarDocumento(activo._id, activo.centro_costo_id, ev.docId, ev.nombreDisplay);
  }

  private subirDocsPendientesSecuencial(activoId: string, centroId: string, index: number): void {
    if (index >= this.docsPendientes.length) {
      this.docsPendientes = [];
      this.cerrar();
      return;
    }
    const { file, linkUrl, nombre } = this.docsPendientes[index];
    const onSuccess = () => this.subirDocsPendientesSecuencial(activoId, centroId, index + 1);
    if (linkUrl) {
      this.service.subirDocumentoLink(activoId, centroId, linkUrl, nombre, onSuccess);
    } else if (file) {
      this.service.subirDocumento(activoId, centroId, file, nombre, onSuccess);
    }
  }

  // ── Gestión de tipos ──────────────────────────────────────────────
  protected showTipoForm  = signal(false);
  protected editingTipoId = signal<string | null>(null);
  protected tipoForm      = signal<TipoForm>(emptyTipoForm());

  abrirTiposModal(): void {
    this.editingTipoId.set(null);
    this.tipoForm.set(emptyTipoForm());
    this.showTipoForm.set(false);
    this.tiposService.clearStatus();
    this.modal.set('tipos');
  }

  abrirNuevoTipo(): void {
    this.editingTipoId.set(null);
    this.tipoForm.set(emptyTipoForm());
    this.showTipoForm.set(true);
    this.tiposService.clearStatus();
  }

  abrirEditarTipo(t: TipoActivo): void {
    this.editingTipoId.set(t._id);
    this.tipoForm.set({ nombre: t.nombre, color: t.color, icono: t.icono ?? 'herramienta' });
    this.showTipoForm.set(true);
    this.tiposService.clearStatus();
  }

  cerrarTipoForm(): void {
    this.showTipoForm.set(false);
    this.editingTipoId.set(null);
  }

  patchTipoForm(field: keyof TipoForm, value: string): void {
    this.tipoForm.update(f => ({ ...f, [field]: value }));
  }

  guardarTipo(): void {
    const f = this.tipoForm();
    if (!f.nombre.trim()) return;
    const dto = { nombre: f.nombre.trim(), color: f.color, icono: f.icono || undefined };
    const id = this.editingTipoId();
    if (id) this.tiposService.actualizar(id, dto);
    else     this.tiposService.crear(dto);
  }

  eliminarTipo(id: string): void {
    const tipo = this.tiposService.tipos().find(t => t._id === id);
    if (tipo && !confirmarEliminacion(`el tipo de activo ${tipo.nombre}`)) return;
    this.tiposService.eliminar(id);
  }
}
