import { Component, OnInit, inject, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivosService } from '../activos.service';
import { TiposActivoService } from '../tipos-activo.service';
import { CentrosService } from '../../centros/centros.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { ActivosListComponent } from '../components/activos-list/activos-list.component';
import { ActivoRevisarModalComponent } from '../components/activo-revisar-modal/activo-revisar-modal.component';
import { Activo, ActividadHistorialItem } from '../../../shared/models/activo.model';
import { asId } from '../../../shared/utils';

@Component({
  selector: 'app-mis-activos-page',
  standalone: true,
  imports: [FormsModule, ActivosListComponent, ActivoRevisarModalComponent],
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
      <button class="btn-ghost" (click)="busquedaVisible.set(!busquedaVisible())">
        {{ busquedaVisible() ? 'Cerrar' : 'Buscar' }}
      </button>
    </div>

    @if (service.loading()) {
      <p class="empty">Cargando activos...</p>
    } @else {
      <app-activos-list
        [activos]="activosFiltrados()"
        [centros]="centrosService.centros()"
        [clientes]="clientes()"
        [tipos]="tiposService.tipos()"
        [mostrarAcciones]="false"
        (revisado)="abrirRevisar($event)">
      </app-activos-list>
    }

    @if (activoRevisando()) {
      <div class="modal-backdrop" (click)="cerrarRevisar()">
        <div class="modal" (click)="$event.stopPropagation()">
          <app-activo-revisar-modal
            [activo]="activoRevisando()"
            [historial]="service.historialActivo()"
            [loadingHistorial]="service.loadingHistorial()"
            [documentosActivo]="service.documentosActivo()"
            [documentosActividad]="service.documentosActividad()"
            [loadingDocumentosActividad]="service.loadingDocumentosActividad()"
            (cerrar)="cerrarRevisar()"
            (descargarActivoDoc)="onDescargarActivoDoc($event)"
            (descargarActividadDoc)="onDescargarActividadDoc($event)"
            (actividadAbierta)="onActividadAbierta($event)">
          </app-activo-revisar-modal>
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
    .page-header h2 { margin: 0; font-size: 1.25rem; font-weight: 700; color: #1f2937; flex: 1; }
    .search-input {
      padding: .55rem .9rem;
      border-radius: 8px;
      border: 1px solid rgba(34,33,33,.2);
      font-size: .9rem;
      font-family: inherit;
      width: 220px;
      box-sizing: border-box;
    }
    .search-input:focus { outline: none; border-color: #0095d6; }
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(15,23,42,.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 100; padding: 1rem;
    }
    .modal {
      background: #fff; border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15,23,42,.18);
      width: 100%; max-width: 700px; max-height: 90vh; overflow-y: auto; padding: 1.5rem;
    }
  `],
})
export class MisActivosPageComponent implements OnInit {
  protected readonly service        = inject(ActivosService);
  protected readonly tiposService   = inject(TiposActivoService);
  protected readonly centrosService = inject(CentrosService);
  private   readonly ctx            = inject(ConsumidorContextService);

  protected busqueda        = signal('');
  protected busquedaVisible = signal(false);
  protected activoRevisando = signal<Activo | null>(null);

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

  protected onDescargarActividadDoc(ev: { actividadId: string; centroId: string; docId: string; nombreDisplay?: string }): void {
    this.service.descargarDocumentoActividad(ev.actividadId, ev.centroId, ev.docId, ev.nombreDisplay);
  }

  ngOnInit(): void {}
}
