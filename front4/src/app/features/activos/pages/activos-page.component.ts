import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivosService } from '../activos.service';
import { CentrosService } from '../../centros/centros.service';
import { ClientesService } from '../../clientes/clientes.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { ActivosFormComponent, DocPendiente } from '../components/activos-form/activos-form.component';
import { ActivosListComponent } from '../components/activos-list/activos-list.component';
import { Activo, CreateActivoDto, DocActivo } from '../../../shared/models/activo.model';

type ModalMode = 'crear' | 'editar' | 'buscar' | null;

@Component({
  selector: 'app-activos-page',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent, ActivosFormComponent, ActivosListComponent],
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
      max-width: 860px;
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
  `],
})
export class ActivosPageComponent implements OnInit {
  protected readonly service         = inject(ActivosService);
  protected readonly centrosService  = inject(CentrosService);
  protected readonly clientesService = inject(ClientesService);

  protected modal     = signal<ModalMode>(null);
  protected busqueda  = signal('');
  protected editingId = signal<string | null>(null);

  protected docsPendientes: DocPendiente[] = [];
  protected subiendoDocs = false;

  protected activosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.service.activos();
    return this.service.activos().filter(a =>
      a.nombre.toLowerCase().includes(q) || a.tipo_activo.toLowerCase().includes(q)
    );
  });

  protected get activoEditando(): Activo | null {
    const id = this.editingId();
    return id ? this.service.activos().find(a => a._id === id) ?? null : null;
  }

  protected get docsExistentes(): DocActivo[] {
    return this.activoEditando?.documentos ?? [];
  }

  constructor() {
    effect(() => {
      if (
        this.service.status()?.type === 'ok' &&
        this.modal() !== null &&
        this.modal() !== 'buscar' &&
        !this.subiendoDocs
      ) {
        this.cerrar();
      }
    });
  }

  ngOnInit(): void {
    this.centrosService.cargar();
    this.service.cargar();
    this.clientesService.cargar();
  }

  protected abrirCrear(): void {
    this.editingId.set(null);
    this.docsPendientes = [];
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
    this.service.seleccionar(activo);
    this.modal.set('editar');
  }

  protected cerrar(): void {
    this.modal.set(null);
    this.editingId.set(null);
    this.docsPendientes = [];
    this.subiendoDocs = false;
    this.service.seleccionado.set(null);
    this.service.clearStatus();
  }

  protected crear(dto: CreateActivoDto): void {
    this.service.crear(dto, (nuevo) => {
      if (this.docsPendientes.length === 0) return;
      this.subiendoDocs = true;
      this.editingId.set(nuevo._id);
      this.subirDocsPendientesSecuencial(nuevo._id, dto.centro_costo_id, 0);
    });
  }

  protected actualizar(dto: CreateActivoDto): void {
    const id = this.service.seleccionado()?._id;
    if (id) this.service.actualizar(id, dto);
  }

  protected eliminar(id: string): void {
    const activo = this.service.activos().find(a => a._id === id);
    if (activo) this.service.seleccionar(activo);
    this.service.eliminar(id);
  }

  protected editarDesdeBuscar(activo: Activo): void {
    this.service.seleccionar(activo);
    this.editingId.set(activo._id);
    this.modal.set('editar');
  }

  protected onDocAgregado(doc: DocPendiente): void {
    this.docsPendientes = [...this.docsPendientes, doc];
  }

  protected onDocQuitado(index: number): void {
    this.docsPendientes = this.docsPendientes.filter((_, i) => i !== index);
  }

  protected onDocSubido(doc: DocPendiente): void {
    const activo = this.activoEditando;
    if (!activo) return;
    this.service.subirDocumento(activo._id, activo.centro_costo_id, doc.file, doc.nombre);
  }

  protected onDocEliminado(nombre: string): void {
    const activo = this.activoEditando;
    if (!activo) return;
    this.service.eliminarDocumento(activo._id, activo.centro_costo_id, nombre);
  }

  protected onDocDescargado(ev: { nombre: string; nombreDisplay?: string }): void {
    const activo = this.activoEditando;
    if (!activo) return;
    this.service.descargarDocumento(activo._id, activo.centro_costo_id, ev.nombre, ev.nombreDisplay);
  }

  private subirDocsPendientesSecuencial(activoId: string, centroId: string, index: number): void {
    if (index >= this.docsPendientes.length) {
      this.docsPendientes = [];
      this.subiendoDocs = false;
      this.cerrar();
      return;
    }
    const { file, nombre } = this.docsPendientes[index];
    this.service.subirDocumento(activoId, centroId, file, nombre,
      () => this.subirDocsPendientesSecuencial(activoId, centroId, index + 1),
      () => { this.subiendoDocs = false; },
    );
  }
}
