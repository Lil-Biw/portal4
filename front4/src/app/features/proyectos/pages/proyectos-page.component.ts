import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProyectosService } from '../proyectos.service';
import { TiposProyectoService } from '../tipos-proyecto.service';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { ProyectoFormComponent } from '../components/proyecto-form/proyecto-form.component';
import { ProyectosListComponent } from '../components/proyectos-list/proyectos-list.component';
import { ProyectoIconoComponent } from '../components/proyecto-icono/proyecto-icono.component';
import { Proyecto, CreateProyectoDto, TipoProyecto } from '../../../shared/models/proyecto.model';
import { asId, confirmarEliminacion } from '../../../shared/utils';
import { AuthService } from '../../auth/auth.service';
import { ICONOS_PROYECTO } from '../proyectos-icons';

type ModalMode = 'crear' | 'editar' | 'buscar' | 'tipos' | null;

interface TipoForm { nombre: string; color: string; icono: string; }
function emptyTipoForm(): TipoForm { return { nombre: '', color: '#00AEEF', icono: 'calendario' }; }

@Component({
  selector: 'app-proyectos-page',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, StatusBannerComponent, ProyectoFormComponent, ProyectosListComponent, ProyectoIconoComponent],
  templateUrl: './proyectos-page.component.html',
  styles: [`
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 1.25rem;
      gap: 1rem;
    }
    .page-header h2 { margin: 0 0 .15rem; font-size: 1.4rem; font-weight: 700; color: var(--fg-2); }
    .page-subtitle { margin: 0; font-size: .85rem; color: var(--fg-4); }
    .header-actions { display: flex; gap: .6rem; flex-shrink: 0; align-items: flex-start; }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: var(--overlay);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1rem;
    }
    .modal {
      background: var(--bg-0);
      border-radius: 16px;
      box-shadow: var(--shadow-4);
      width: 100%;
      max-width: 680px;
      max-height: 85vh;
      overflow-y: auto;
      padding: 0;
    }
    /* Header fijo: solo el contenido scrollea (el footer fijo vive en el form) */
    .modal-header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--bg-0);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.15rem 1.5rem 1rem;
      border-bottom: 1px solid var(--border-subtle);
    }
    .modal-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .modal-sub { margin: .2rem 0 0; font-size: .8rem; color: var(--fg-4); }
    .modal-close {
      background: none;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.05rem;
      line-height: 1;
      cursor: pointer;
      color: var(--fg-4);
      flex-shrink: 0;
      transition: background .15s;
    }
    .modal-close:hover { background: var(--border-subtle); color: var(--fg-2); }
    .modal-body { padding: 1.25rem 1.5rem; }
    .modal--tipos { max-width: 840px; }
    .search-input {
      width: 100%;
      padding: .65rem .9rem;
      border-radius: 8px;
      border: 1px solid var(--border-strong);
      font-size: .9rem;
      font-family: inherit;
      margin-bottom: 1rem;
      box-sizing: border-box;
    }
    .search-input:focus { outline: none; border-color: var(--sc-cyan); }
    .tipos-modal {
      display: grid;
      /* minmax(0,…): sin esto los nombres largos (nowrap implícito del
         min-content) desbordan la columna y empujan los botones fuera del modal */
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 1.5rem;
      align-items: start;
    }
    .tipos-col-title {
      font-size: .9rem;
      font-weight: 700;
      color: var(--fg-2);
      margin: 0 0 .75rem;
    }
    .tipos-empty { color: var(--fg-5); font-size: .85rem; margin: .5rem 0; }
    .tipos-list { display: flex; flex-direction: column; gap: 0; max-height: min(55vh, 480px); overflow-y: auto; padding-right: .25rem; }
    .tipo-item {
      display: flex;
      align-items: center;
      gap: .6rem;
      padding: .5rem 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    .tipo-item:last-child { border-bottom: none; }
    .tipo-texto { flex: 1; min-width: 0; }
    .tipo-nombre { font-size: .85rem; font-weight: 600; color: var(--fg-2); word-break: break-word; }
    .tipo-actions { display: flex; gap: .35rem; flex-shrink: 0; }
    .tipo-input {
      width: 100%;
      padding: .5rem .7rem;
      border: 1px solid var(--border-strong);
      border-radius: 8px;
      font-size: .85rem;
      font-family: inherit;
      box-sizing: border-box;
      margin-bottom: .5rem;
    }
    .tipo-input:focus { outline: 2px solid var(--sc-cyan); border-color: transparent; }

    /* ── Tipo-combo (context card) ───────────────────────────── */
    .tipo-combo { position: relative; }
    .tipo-combo-input {
      width: 100%; box-sizing: border-box;
      padding: .55rem .75rem; padding-right: 2rem;
      border: 1px solid var(--border-default); border-radius: 8px;
      font-size: .875rem; color: var(--fg-2); font-family: inherit;
      background: var(--bg-0); cursor: text; outline: none;
      transition: border-color .15s;
    }
    .tipo-combo-input:focus { border-color: var(--sc-cyan); }
    .tipo-combo-input::placeholder { color: var(--fg-5); }
    .tipo-combo-arrow {
      position: absolute; right: .65rem; top: 50%; transform: translateY(-50%);
      pointer-events: none; color: var(--fg-5); display: flex; align-items: center;
    }
    .tipo-combo-dropdown {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0;
      background: var(--bg-0); border: 1px solid var(--border-default); border-radius: 8px;
      box-shadow: var(--shadow-3); z-index: 200;
      max-height: 200px; overflow-y: auto;
    }
    .tipo-combo-option {
      padding: .5rem .75rem; font-size: .875rem; color: var(--fg-2);
      cursor: pointer; display: flex; align-items: center; gap: .5rem;
      transition: background .1s;
    }
    .tipo-combo-option:hover, .tipo-combo-option--active { background: var(--sc-cyan-tint-6); color: var(--sc-cyan); }
    .tipo-combo-empty { padding: .5rem .75rem; font-size: .83rem; color: var(--fg-5); }
  `],
})
export class ProyectosPageComponent implements OnInit {
  protected readonly service         = inject(ProyectosService);
  protected readonly tiposService     = inject(TiposProyectoService);
  protected readonly clientesService  = inject(ClientesService);
  protected readonly centrosService   = inject(CentrosService);
  protected readonly authService        = inject(AuthService);

  protected readonly iconosProyecto = ICONOS_PROYECTO;

  protected puedeGestionarTipos = computed(() =>
    this.authService.tienePermiso('catalogos', 'crear') ||
    this.authService.tienePermiso('catalogos', 'editar') ||
    this.authService.tienePermiso('catalogos', 'eliminar')
  );

  constructor() {
    effect(() => {
      if (this.tiposService.status()?.type === 'ok' && this.showTipoForm()) {
        this.cerrarTipoForm();
      }
    });
  }

  protected modal    = signal<ModalMode>(null);
  protected busqueda = signal('');

  protected proyectosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.service.proyectos();
    return this.service.proyectos().filter(p => {
      const empresa = this.clientesService.clientes()
        .find(x => asId(x._id) === asId(p.cliente_id))?.razon_social ?? '';
      const centroIds = (p.centro_costo_ids ?? []).map(id => asId(id));
      const centros = this.centrosService.centros()
        .filter(x => centroIds.includes(asId(x._id)))
        .map(x => x.nombre);
      return p.nombre.toLowerCase().includes(q) ||
             p.codigo.toLowerCase().includes(q) ||
             empresa.toLowerCase().includes(q)  ||
             centros.some(c => c.toLowerCase().includes(q));
    });
  });

  // ── Contexto ─────────────────────────────────────────────────────────────
  private _selectedEmpresaId = signal('');
  private _selectedCentroId  = signal('');
  protected _selectedTipoId  = signal('');
  private _selectedEstado   = signal('');

  get selectedEmpresaId()          { return this._selectedEmpresaId(); }
  set selectedEmpresaId(v: string) { this._selectedEmpresaId.set(v); }
  get selectedCentroId()           { return this._selectedCentroId(); }
  set selectedCentroId(v: string)  { this._selectedCentroId.set(v); }
  get selectedTipoId()             { return this._selectedTipoId(); }
  set selectedTipoId(v: string)    { this._selectedTipoId.set(v); }
  get selectedEstado()             { return this._selectedEstado(); }
  set selectedEstado(v: string)    { this._selectedEstado.set(v); }

  protected readonly estadosFiltro: { value: string; label: string }[] = [
    { value: 'estancado',            label: 'Estancado'            },
    { value: 'nuevo_sin_oc',         label: 'Nuevos por Programar / Sin OC'         },
    { value: 'nuevo_con_oc',         label: 'Nuevos por Programar / Con OC'         },
    { value: 'en_ejecucion',         label: 'En ejecución'                         },
    { value: 'cierre_pendiente',     label: 'Cierre pendiente / Validación Interna' },
    { value: 'finalizado_facturar',  label: 'Finalizado / Listo para facturar'      },
    { value: 'finalizado_facturado', label: 'Finalizado y facturado' },
  ];

  protected filtroContexto  = signal('');
  protected tipoComboQuery  = signal('');
  protected tipoComboOpen   = signal(false);

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

  protected empresaNombre(p: Proyecto): string {
    return this.clientesService.clientes()
      .find(c => asId(c._id) === asId(p.cliente_id))?.razon_social ?? '';
  }

  protected tipoDeProyecto(p: Proyecto): TipoProyecto | null {
    if (!p.tipo_proyecto_id) return null;
    if (typeof p.tipo_proyecto_id === 'object') return p.tipo_proyecto_id as TipoProyecto;
    return this.tiposService.tipos().find(t => t._id === p.tipo_proyecto_id) ?? null;
  }

  protected proyectosContexto = computed(() => {
    const empresaId = this._selectedEmpresaId();
    const centroId  = this._selectedCentroId();
    const tipoId    = this._selectedTipoId();
    const estado    = this._selectedEstado();
    const tipoQ     = this.tipoComboQuery().toLowerCase().trim();
    const q         = this.filtroContexto().toLowerCase().trim();

    let list = this.service.proyectos();
    if (empresaId) list = list.filter(p => asId(p.cliente_id) === empresaId);
    if (centroId)  list = list.filter(p => (p.centro_costo_ids ?? []).some(id => asId(id) === centroId));
    if (estado)    list = list.filter(p => p.estado === estado);
    if (tipoId) {
      list = list.filter(p => this.tipoDeProyecto(p)?._id === tipoId);
    } else if (tipoQ) {
      list = list.filter(p => (this.tipoDeProyecto(p)?.nombre ?? '').toLowerCase().includes(tipoQ));
    }
    if (q) {
      list = list.filter(p =>
        p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q));
    }
    return list;
  });

  protected onEmpresaContextoChange(): void {
    this._selectedCentroId.set('');
  }

  ngOnInit(): void {
    this.service.cargar();
    this.centrosService.cargar();
    this.clientesService.cargar();
    this.tiposService.cargar();
  }

  protected abrirCrear(): void {
    this.service.seleccionado.set(null);
    this.service.centrosSeleccionados.set([]);
    this.service.clearStatus();
    this.modal.set('crear');
  }

  protected abrirBuscar(): void {
    this.busqueda.set('');
    this.service.clearStatus();
    this.modal.set('buscar');
  }

  protected abrirEditar(proyecto: Proyecto): void {
    this.service.seleccionar(proyecto);
    this.modal.set('editar');
  }

  protected cerrar(): void {
    this.modal.set(null);
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.showTipoForm.set(false);
    this.editingTipoId.set(null);
  }

  protected crear(dto: CreateProyectoDto): void   { this.service.crear(dto); }

  protected actualizar(dto: CreateProyectoDto): void {
    const id = this.service.seleccionado()?._id;
    if (id) this.service.actualizar(id, dto);
  }

  protected eliminar(id: string): void {
    const proyecto = this.service.proyectos().find(p => p._id === id);
    if (proyecto && !confirmarEliminacion(proyecto.nombre)) return;
    if (proyecto) this.service.seleccionar(proyecto);
    this.service.eliminar(id);
  }

  protected editarDesdeBuscar(proyecto: Proyecto): void {
    this.service.seleccionar(proyecto);
    this.modal.set('editar');
  }

  // ── Gestión de tipos ──────────────────────────────────────────────
  protected showTipoForm  = signal(false);
  protected editingTipoId = signal<string | null>(null);
  protected tipoForm      = signal<TipoForm>(emptyTipoForm());

  protected abrirTiposModal(): void {
    this.editingTipoId.set(null);
    this.tipoForm.set(emptyTipoForm());
    this.showTipoForm.set(false);
    this.tiposService.clearStatus();
    this.modal.set('tipos');
  }

  protected abrirNuevoTipo(): void {
    this.editingTipoId.set(null);
    this.tipoForm.set(emptyTipoForm());
    this.showTipoForm.set(true);
    this.tiposService.clearStatus();
  }

  protected abrirEditarTipo(t: TipoProyecto): void {
    this.editingTipoId.set(t._id);
    this.tipoForm.set({ nombre: t.nombre, color: t.color, icono: t.icono ?? '' });
    this.showTipoForm.set(true);
    this.tiposService.clearStatus();
  }

  protected cerrarTipoForm(): void {
    this.showTipoForm.set(false);
    this.editingTipoId.set(null);
  }

  protected patchTipoForm(field: keyof TipoForm, value: string): void {
    this.tipoForm.update(f => ({ ...f, [field]: value }));
  }

  protected guardarTipo(): void {
    const f = this.tipoForm();
    if (!f.nombre.trim()) return;
    const dto = { nombre: f.nombre.trim(), color: f.color, icono: f.icono || undefined };
    const id = this.editingTipoId();
    if (id) this.tiposService.actualizar(id, dto);
    else     this.tiposService.crear(dto);
  }

  protected eliminarTipo(id: string): void {
    const tipo = this.tiposService.tipos().find(t => t._id === id);
    if (tipo && !confirmarEliminacion(`el tipo de proyecto ${tipo.nombre}`)) return;
    this.tiposService.eliminar(id);
  }
}
