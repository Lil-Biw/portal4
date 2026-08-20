import { Component, OnInit, inject, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivosService } from '../activos.service';
import { TiposActivoService } from '../tipos-activo.service';
import { CentrosService } from '../../centros/centros.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { AuthService } from '../../auth/auth.service';
import { ActivosListComponent } from '../components/activos-list/activos-list.component';
import { ActivosFormComponent, DocPendiente } from '../components/activos-form/activos-form.component';
import { ActivoRevisarModalComponent } from '../components/activo-revisar-modal/activo-revisar-modal.component';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { Activo, ActividadHistorialItem, CreateActivoDto, DocActivo } from '../../../shared/models/activo.model';
import { asId, confirmarEliminacion } from '../../../shared/utils';
import { esImagenDoc } from '../galeria-fotos.utils';

type ActivoModal = 'crear' | 'editar' | null;

@Component({
  selector: 'app-mis-activos-page',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent, ActivosListComponent, ActivoRevisarModalComponent, ActivosFormComponent],
  template: `
    <div class="page-header">
      <h2>Mis activos</h2>
      @if (busquedaVisible()) {
        <input
          class="search-input"
          type="text"
          placeholder="Nombre o tipo..."
          [ngModel]="busqueda()"
          (ngModelChange)="busqueda.set($event)"
          autofocus />
      }
      <div class="header-actions">
        <button class="btn-ghost" (click)="busquedaVisible.set(!busquedaVisible())">
          {{ busquedaVisible() ? 'Cerrar' : 'Buscar' }}
        </button>
        @if (authService.tienePermiso('activos', 'crear')) {
          <button class="btn-primary" (click)="abrirCrear()">+ Crear activo</button>
        }
      </div>
    </div>

    @if (service.loading()) {
      <p class="empty">Cargando activos...</p>
    } @else {
      <app-activos-list
        [activos]="activosFiltrados()"
        [centros]="centrosService.centros()"
        [clientes]="clientes()"
        [tipos]="tiposService.tipos()"
        [puedeEditar]="authService.tienePermiso('activos', 'editar')"
        [puedeEliminar]="authService.tienePermiso('activos', 'eliminar')"
        (editado)="abrirEditar($event)"
        (eliminado)="eliminar($event)"
        (revisado)="abrirRevisar($event)">
      </app-activos-list>
    }

    @if (activoRevisando()) {
      <div class="modal-backdrop">
        <div class="modal modal-revisar" [style.max-width]="anchoModalRevisar" (click)="$event.stopPropagation()">
          <app-activo-revisar-modal
            [activo]="activoRevisando()"
            [historial]="service.historialActivo()"
            [loadingHistorial]="service.loadingHistorial()"
            [documentosActivo]="service.documentosActivo()"
            [documentosActividad]="service.documentosActividad()"
            [loadingDocumentosActividad]="service.loadingDocumentosActividad()"
            [imagenesActivo]="service.imagenesActivo()"
            (cerrar)="cerrarRevisar()"
            (descargarActivoDoc)="onDescargarActivoDoc($event)"
            (descargarActividadDoc)="onDescargarActividadDoc($event)"
            (actividadAbierta)="onActividadAbierta($event)"
            (cargarImagenActivo)="onCargarImagenActivo($event)">
          </app-activo-revisar-modal>
        </div>
      </div>
    }

    @if (modal() !== null) {
      <div class="modal-backdrop">
        <div class="modal modal-form" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ modal() === 'crear' ? 'Nuevo activo' : 'Editar activo' }}</h3>
            <button class="modal-close" (click)="cerrarModal()">&#x2715;</button>
          </div>
          <app-status-banner [status]="service.status()"></app-status-banner>
          <app-activos-form
            [initial]="activoEditando()"
            [clientes]="clientes()"
            [centros]="centrosService.centros()"
            [tipos]="tiposService.tipos()"
            [editingId]="editingId()"
            [docsPendientes]="docsPendientes"
            [docsExistentes]="docsExistentes"
            [subiendoCards]="subiendoCards()"
            [eliminandoDocIds]="eliminandoDocIds()"
            [submitLabel]="modal() === 'crear' ? 'Crear activo' : 'Guardar activo'"
            (submitted)="onFormSubmitted($event)"
            (cancelar)="cerrarModal()"
            (docAgregado)="onDocAgregado($event)"
            (docQuitado)="onDocQuitado($event)"
            (docSubido)="onDocSubido($event)"
            (docEliminado)="onDocEliminado($event)"
            (docDescargado)="onDocDescargado($event)"
            (docRenombrado)="onDocRenombrado($event)">
          </app-activos-form>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      gap: .6rem;
      margin-bottom: 1.25rem;
    }
    .page-header h2 { margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--fg-2); flex: 1; }
    .header-actions { display: flex; gap: .6rem; align-items: center; }
    .search-input {
      padding: .55rem .9rem;
      border-radius: 8px;
      border: 1px solid var(--border-strong);
      font-size: .9rem;
      font-family: inherit;
      width: 220px;
      box-sizing: border-box;
    }
    .search-input:focus { outline: none; border-color: var(--sc-cyan); }
    .modal-backdrop {
      position: fixed; inset: 0; background: var(--overlay);
      display: flex; align-items: center; justify-content: center;
      z-index: 100; padding: 1rem;
    }
    .modal {
      background: var(--bg-0); border-radius: 16px;
      box-shadow: var(--shadow-4);
      width: 100%; max-height: 90vh; overflow-y: auto; padding: 1.5rem;
    }
    .modal-revisar { max-width: 960px; }
    .modal-form { max-width: 960px; }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .modal-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .modal-close {
      background: none; border: none; font-size: 1.4rem; line-height: 1;
      cursor: pointer; color: var(--fg-4); padding: 0 .25rem;
    }
    .modal-close:hover { color: var(--fg-2); }
  `],
})
export class MisActivosPageComponent implements OnInit {
  protected readonly service        = inject(ActivosService);
  protected readonly tiposService   = inject(TiposActivoService);
  protected readonly centrosService = inject(CentrosService);
  protected readonly authService    = inject(AuthService);
  private   readonly ctx            = inject(ConsumidorContextService);

  protected busqueda        = signal('');
  protected busquedaVisible = signal(false);
  protected activoRevisando = signal<Activo | null>(null);

  protected modal           = signal<ActivoModal>(null);
  protected editingId       = signal<string | null>(null);
  protected docsPendientes: DocPendiente[] = [];
  protected subiendoCards   = signal<{ id: string; nombre: string }[]>([]);
  protected eliminandoDocIds = signal<Set<string>>(new Set());

  protected activoEditando = computed<Activo | null>(() => {
    const id = this.editingId();
    return id ? this.service.activos().find(a => a._id === id) ?? null : null;
  });

  protected get docsExistentes(): DocActivo[] {
    return this.service.documentosActivo();
  }

  protected get anchoModalRevisar(): string {
    const hayImagenes = this.service.documentosActivo().some(esImagenDoc);
    return hayImagenes ? '960px' : '700px';
  }

  protected clientes = computed(() => {
    const empresa = this.ctx.empresaSeleccionada();
    return empresa ? [empresa] : [];
  });

  private centroIdsPorEmpresa = computed((): Set<string> => {
    const empresa = this.ctx.empresaSeleccionada();
    if (!empresa) return new Set();
    return new Set(
      this.centrosService.centros()
        .filter(c => asId(c.cliente_id) === asId(empresa._id))
        .map(c => asId(c._id))
    );
  });

  protected activosFiltrados = computed(() => {
    const q    = this.busqueda().toLowerCase().trim();
    const ids  = this.centroIdsPorEmpresa();
    let list   = this.service.activos().filter(a => ids.has(asId(a.centro_costo_id)));
    if (q) list = list.filter(a => a.nombre.toLowerCase().includes(q));
    return list;
  });

  constructor() {
    effect(() => {
      const empresa = this.ctx.empresaSeleccionada();
      if (!empresa) { this.service.activos.set([]); return; }
      const id = asId(empresa._id);
      this.centrosService.cargarPorEmpresa(id);
    });

    effect(() => {
      const empresa  = this.ctx.empresaSeleccionada();
      const centroIds = [...this.centroIdsPorEmpresa()];
      if (empresa && centroIds.length > 0) {
        this.service.cargarPorCentros(asId(empresa._id), centroIds);
      }
    });
  }

  protected abrirRevisar(activo: Activo): void {
    this.activoRevisando.set(activo);
    this.service.cargarHistorial(activo._id, activo.centro_costo_id);
    this.service.listarDocumentos(activo._id, activo.centro_costo_id);
  }

  protected cerrarRevisar(): void {
    this.activoRevisando.set(null);
    this.service.resetHistorial();
    this.service.resetDocumentos();
  }

  protected onActividadAbierta(item: ActividadHistorialItem): void {
    const activo = this.activoRevisando();
    if (!activo) return;
    this.service.listarDocumentosActividad(item._id, activo.centro_costo_id);
  }

  protected onDescargarActivoDoc(ev: { docId: string; nombreDisplay?: string }): void {
    const activo = this.activoRevisando();
    if (!activo) return;
    this.service.descargarDocumento(activo._id, activo.centro_costo_id, ev.docId, ev.nombreDisplay);
  }

  protected onCargarImagenActivo(ev: { docId: string }): void {
    const activo = this.activoRevisando();
    if (!activo) return;
    this.service.cargarImagenActivo(activo._id, activo.centro_costo_id, ev.docId);
  }

  protected onDescargarActividadDoc(ev: { actividadId: string; centroId: string; docId: string; nombreDisplay?: string }): void {
    this.service.descargarDocumentoActividad(ev.actividadId, ev.centroId, ev.docId, ev.nombreDisplay);
  }

  ngOnInit(): void {
    this.tiposService.cargar();
  }

  // ── Modal crear/editar ───────────────────────────────────────────────────
  abrirCrear(): void {
    this.editingId.set(null);
    this.docsPendientes = [];
    this.subiendoCards.set([]);
    this.eliminandoDocIds.set(new Set());
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.modal.set('crear');
  }

  abrirEditar(activo: Activo): void {
    this.editingId.set(activo._id);
    this.docsPendientes = [];
    this.subiendoCards.set([]);
    this.eliminandoDocIds.set(new Set());
    this.service.seleccionar(activo);
    this.service.listarDocumentos(activo._id, activo.centro_costo_id);
    this.service.clearStatus();
    this.modal.set('editar');
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.editingId.set(null);
    this.docsPendientes = [];
    this.subiendoCards.set([]);
    this.eliminandoDocIds.set(new Set());
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.service.resetDocumentos();
  }

  eliminar(id: string): void {
    const activo = this.service.activos().find(a => a._id === id);
    if (activo && !confirmarEliminacion(activo.nombre)) return;
    if (activo) this.service.seleccionar(activo);
    this.service.eliminar(id);
  }

  protected onFormSubmitted(dto: CreateActivoDto): void {
    if (this.modal() === 'crear') {
      this.service.crear(dto, (nuevo) => {
        this.editingId.set(nuevo._id);
        if (this.docsPendientes.length > 0) {
          this.subirDocsPendientesSecuencial(nuevo._id, dto.centro_costo_id, 0);
        } else {
          this.cerrarModal();
        }
      });
      return;
    }
    const id = this.service.seleccionado()?._id;
    if (id) this.service.actualizar(id, dto, () => this.cerrarModal());
  }

  protected onDocAgregado(doc: DocPendiente): void {
    this.docsPendientes = [...this.docsPendientes, doc];
  }

  protected onDocQuitado(localId: string): void {
    this.docsPendientes = this.docsPendientes.filter(d => d.localId !== localId);
  }

  protected onDocSubido(doc: DocPendiente): void {
    const activo = this.activoEditando();
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
    const activo = this.activoEditando();
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
    const activo = this.activoEditando();
    if (!activo) return;
    this.service.descargarDocumento(activo._id, activo.centro_costo_id, ev.docId, ev.nombreDisplay);
  }

  protected onDocRenombrado(ev: { id: string; nuevoNombre: string }): void {
    const activo = this.activoEditando();
    if (!activo) return;
    this.service.renombrarDocumento(activo._id, activo.centro_costo_id, ev.id, ev.nuevoNombre);
  }

  private subirDocsPendientesSecuencial(activoId: string, centroId: string, index: number): void {
    if (index >= this.docsPendientes.length) {
      this.docsPendientes = [];
      this.cerrarModal();
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
}
