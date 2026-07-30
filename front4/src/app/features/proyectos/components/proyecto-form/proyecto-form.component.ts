import { Component, EventEmitter, Input, OnChanges, SimpleChanges, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { Proyecto, CreateProyectoDto, EstadoProyecto, TipoProyecto } from '../../../../shared/models/proyecto.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { Status } from '../../../../shared/models/status.model';
import { asId } from '../../../../shared/utils';
import { ProyectoIconoComponent } from '../proyecto-icono/proyecto-icono.component';
import { StatusBannerComponent } from '../../../../shared/components/status-banner/status-banner.component';

@Component({
  selector: 'app-proyecto-form',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, ProyectoIconoComponent, StatusBannerComponent],
  templateUrl: './proyecto-form.component.html',
  styles: [`
    .pf { display: flex; flex-direction: column; }
    .pf-body {
      padding: 1.25rem 1.5rem;
      display: flex; flex-direction: column; gap: 1.35rem;
    }
    .pf-seccion { display: flex; flex-direction: column; gap: .85rem; }
    .pf-seccion-titulo {
      margin: 0;
      font-size: .7rem; font-weight: 700;
      letter-spacing: .08em; text-transform: uppercase;
      color: #0075a8;
      display: flex; align-items: center; gap: .6rem;
    }
    .pf-seccion-titulo::after {
      content: ""; flex: 1; height: 1px; background: rgba(0,149,214,.18);
    }
    .pf-label-row { display: flex; align-items: center; gap: .5rem; }
    .pf-badge {
      font-size: .72rem; font-weight: 700; color: #0075a8;
      background: rgba(0,149,214,.12);
      padding: .12rem .5rem; border-radius: 999px;
    }
    .pf-hint { margin: 0; font-size: .78rem; color: #6b7280; line-height: 1.45; }

    /* Centros: buscador + lista en un solo panel */
    .centros-panel {
      border: 1px solid rgba(34,33,33,.18);
      border-radius: 10px;
      overflow: hidden;
    }
    .centros-search {
      display: flex; align-items: center; gap: .5rem;
      padding: .5rem .75rem;
      border-bottom: 1px solid rgba(34,33,33,.1);
      background: #f8fafc;
    }
    .centros-search svg { color: #9ca3af; flex-shrink: 0; }
    .centros-search input {
      border: none; background: transparent; outline: none;
      font-family: inherit; font-size: .875rem; color: #1f2937; width: 100%;
    }
    .centros-lista {
      max-height: 168px; overflow-y: auto; padding: .35rem;
      scrollbar-width: thin;
      scrollbar-color: rgba(0,0,0,.15) transparent;
    }
    .centro-row {
      display: flex; align-items: center; gap: .6rem;
      padding: .45rem .6rem; border-radius: 7px;
      font-size: .875rem; color: #374151; cursor: pointer;
      transition: background .12s;
    }
    .centro-row:hover { background: rgba(0,149,214,.06); }
    .centro-row input { accent-color: #0095d6; width: 15px; height: 15px; margin: 0; }
    .centro-row--sel { background: rgba(0,149,214,.09); color: #0075a8; font-weight: 600; }
    .centros-empty {
      margin: 0; font-size: .82rem; color: #9ca3af;
      text-align: center; padding: .35rem 0;
    }

    /* Recordatorios como chips toggle */
    .pf-pills { display: flex; flex-wrap: wrap; gap: .45rem; }
    .pf-pill {
      display: inline-flex; align-items: center; gap: .38rem;
      padding: .38rem .8rem; border-radius: 999px;
      border: 1px solid rgba(34,33,33,.18);
      font-size: .82rem; font-weight: 600; color: #4b5563;
      background: #fff; cursor: pointer; user-select: none;
      transition: all .13s;
    }
    .pf-pill input { position: absolute; opacity: 0; pointer-events: none; }
    .pf-pill:hover { border-color: rgba(0,149,214,.5); }
    .pf-pill--on {
      background: rgba(0,149,214,.1);
      border-color: #0095d6;
      color: #0075a8;
    }
    .pf-pill-check { display: none; font-size: .75rem; }
    .pf-pill--on .pf-pill-check { display: inline; }

    /* Footer fijo al fondo del modal (el .modal es el contenedor de scroll) */
    .pf-footer {
      position: sticky; bottom: 0;
      display: flex; justify-content: flex-end; gap: .6rem;
      padding: .9rem 1.5rem;
      background: #fbfcfd;
      border-top: 1px solid rgba(34,33,33,.08);
    }

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
    .tipo-combo-empty { padding: .5rem .75rem; font-size: .83rem; color: #9ca3af; }
  `],
})
export class ProyectoFormComponent implements OnChanges {
  @Input() initial: Proyecto | null = null;
  @Input() clientes: Cliente[] = [];
  @Input() centros: CentroCosto[] = [];
  @Input() tipos: TipoProyecto[] = [];
  @Input() centrosSeleccionados: string[] = [];
  @Input() submitLabel = 'Guardar';
  @Input() status: Status | null = null;
  @Output() submitted = new EventEmitter<CreateProyectoDto>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() centroToggle = new EventEmitter<{ centroId: string; checked: boolean }>();
  @Output() clienteChange = new EventEmitter<string>();

  centroQuery = signal('');

  get centrosFiltradosPorBusqueda(): CentroCosto[] {
    const q = this.centroQuery().toLowerCase().trim();
    const lista = this.centrosFiltrados;
    if (!q) return lista;
    return lista.filter(c => c.nombre.toLowerCase().includes(q));
  }

  form: CreateProyectoDto = this.empty();

  readonly opcionesDiasRecordatorio = [
    { valor: 365, label: '1 año antes' },
    { valor: 180, label: '6 meses antes' },
    { valor: 30, label: '30 días antes' },
    { valor: 15, label: '15 días antes' },
    { valor: 7,  label: '7 días antes' },
    { valor: 3,  label: '3 días antes' },
    { valor: 1,  label: '1 día antes' },
    { valor: 0,  label: 'El día de término' },
  ];

  diaRecordatorioChecked(valor: number): boolean {
    return (this.form.dias_recordatorio ?? []).includes(valor);
  }

  toggleDiaRecordatorio(valor: number, checked: boolean): void {
    const dias = new Set(this.form.dias_recordatorio ?? []);
    checked ? dias.add(valor) : dias.delete(valor);
    this.form.dias_recordatorio = Array.from(dias);
  }

  readonly estados: { value: EstadoProyecto; label: string }[] = [
    { value: 'estancado',            label: 'Estancado'              },
    { value: 'nuevo_sin_oc',         label: 'Nuevos por Programar / Sin OC'         },
    { value: 'nuevo_con_oc',         label: 'Nuevos por Programar / Con OC'         },
    { value: 'en_ejecucion',         label: 'En ejecución'                         },
    { value: 'cierre_pendiente',     label: 'Cierre pendiente / Validación Interna' },
    { value: 'finalizado_facturar',  label: 'Finalizado / Listo para facturar'      },
    { value: 'finalizado_facturado', label: 'Finalizado y facturado' },
  ];

  tipoQuery        = signal('');
  tipoDropdownOpen = signal(false);
  private _tipos   = signal<TipoProyecto[]>([]);

  tiposFiltrados = computed(() => {
    const q = this.tipoQuery().toLowerCase().trim();
    if (!q) return this._tipos();
    return this._tipos().filter(t => t.nombre.toLowerCase().includes(q));
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tipos']) {
      this._tipos.set(this.tipos);
      this.syncTipoQuery();
    }
    if (changes['initial']) {
      this.form = this.initial
        ? {
            cliente_id:     asId(this.initial.cliente_id),
            centro_costo_ids: [],
            tipo_proyecto_id: this.initial.tipo_proyecto_id
              ? asId(typeof this.initial.tipo_proyecto_id === 'object' ? (this.initial.tipo_proyecto_id as TipoProyecto)._id : this.initial.tipo_proyecto_id)
              : '',
            codigo:         this.initial.codigo,
            nombre:         this.initial.nombre,
            descripcion:    this.initial.descripcion ?? '',
            estado:         this.initial.estado,
            fecha_inicio:   this.initial.fecha_inicio ?? '',
            fecha_fin:      this.initial.fecha_fin ?? '',
            dias_recordatorio: [...(this.initial.dias_recordatorio ?? [])],
          }
        : this.empty();
      if (!this.form.tipo_proyecto_id) this.tipoQuery.set('');
      this.syncTipoQuery();
    }
  }

  private syncTipoQuery(): void {
    if (!this.form.tipo_proyecto_id) return;
    const tipo = this.tipos.find(t => t._id === this.form.tipo_proyecto_id);
    if (tipo) this.tipoQuery.set(tipo.nombre);
  }

  onTipoInput(q: string): void {
    this.tipoQuery.set(q);
    this.form.tipo_proyecto_id = '';
    this.tipoDropdownOpen.set(true);
  }

  selectTipo(t: TipoProyecto | null): void {
    this.form.tipo_proyecto_id = t?._id ?? '';
    this.tipoQuery.set(t?.nombre ?? '');
    this.tipoDropdownOpen.set(false);
  }

  onTipoBlur(): void {
    setTimeout(() => {
      this.tipoDropdownOpen.set(false);
      if (!this.form.tipo_proyecto_id) this.tipoQuery.set('');
    }, 150);
  }

  get centrosFiltrados(): CentroCosto[] {
    if (!this.form.cliente_id) return [];
    return this.centros.filter(c => asId(c.cliente_id) === this.form.cliente_id);
  }

  onClienteChange(): void {
    this.clienteChange.emit(this.form.cliente_id);
  }

  submit(): void {
    const dto = { ...this.form, centro_costo_ids: this.centrosSeleccionados };
    if (!dto.tipo_proyecto_id) delete dto.tipo_proyecto_id;
    if (!dto.fecha_inicio) delete dto.fecha_inicio;
    // null explícito (no delete): al editar, vaciar el campo debe borrar la
    // fecha_fin guardada. Si se borrara la clave en vez de mandar null, el
    // backend interpretaría "no la toques" y la fecha vieja (con sus
    // recordatorios/auto-cierre) quedaría vigente para siempre.
    dto.fecha_fin = dto.fecha_fin || null;
    this.submitted.emit(dto);
  }

  private empty(): CreateProyectoDto {
    // Recordatorios: por defecto todas las antelaciones marcadas al crear
    return { cliente_id: '', centro_costo_ids: [], tipo_proyecto_id: '', codigo: '', nombre: '', descripcion: '', estado: 'nuevo_sin_oc', fecha_inicio: '', fecha_fin: '', dias_recordatorio: [365, 180, 30, 15, 7, 3, 1, 0] };
  }
}
