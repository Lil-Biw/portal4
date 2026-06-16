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
import { Activo, CreateActivoDto, DocActivo, TipoActivo } from '../../../shared/models/activo.model';

type ModalMode = 'crear' | 'editar' | 'buscar' | 'tipos' | null;

interface TipoForm { nombre: string; color: string; }
function emptyTipoForm(): TipoForm { return { nombre: '', color: '#0095d6' }; }

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
    .tipos-list { display: flex; flex-direction: column; gap: 0; }
    .tipo-item {
      display: flex;
      align-items: center;
      gap: .6rem;
      padding: .55rem 0;
      border-bottom: 1px solid rgba(34,33,33,.06);
    }
    .tipo-item:last-child { border-bottom: none; }
    .tipo-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
    .tipo-nombre { font-size: .85rem; font-weight: 600; color: #1f2937; flex: 1; }
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
  `],
})
export class ActivosPageComponent implements OnInit {
  protected readonly service         = inject(ActivosService);
  protected readonly tiposService    = inject(TiposActivoService);
  protected readonly centrosService  = inject(CentrosService);
  protected readonly clientesService = inject(ClientesService);
  private readonly authService       = inject(AuthService);

  protected puedeGestionarTipos = computed(() =>
    this.authService.usuarioActual()?.rol === 'super_admin'
  );

  protected modal     = signal<ModalMode>(null);
  protected busqueda  = signal('');
  protected editingId = signal<string | null>(null);

  protected docsPendientes: DocPendiente[] = [];
  protected subiendoDocs = false;

  protected activosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.service.activos();
    return this.service.activos().filter(a => {
      const tipo = this.tipoDeActivo(a);
      return a.nombre.toLowerCase().includes(q) ||
        (tipo?.nombre ?? '').toLowerCase().includes(q);
    });
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
    this.tiposService.cargar();
  }

  protected tipoDeActivo(a: Activo): TipoActivo | null {
    if (typeof a.tipo_activo_id === 'object') return a.tipo_activo_id as TipoActivo;
    return this.tiposService.tipos().find(t => t._id === (a.tipo_activo_id as string)) ?? null;
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
    this.showTipoForm.set(false);
    this.editingTipoId.set(null);
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
    this.tipoForm.set({ nombre: t.nombre, color: t.color });
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
    const dto = { nombre: f.nombre.trim(), color: f.color };
    const id = this.editingTipoId();
    if (id) this.tiposService.actualizar(id, dto);
    else     this.tiposService.crear(dto);
    this.cerrarTipoForm();
  }

  eliminarTipo(id: string): void { this.tiposService.eliminar(id); }
}
