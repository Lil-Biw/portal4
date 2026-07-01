import { Component, EventEmitter, Input, OnChanges, SimpleChanges, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { Proyecto, CreateProyectoDto, EstadoProyecto, TipoProyecto } from '../../../../shared/models/proyecto.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { asId } from '../../../../shared/utils';
import { ProyectoIconoComponent } from '../proyecto-icono/proyecto-icono.component';

@Component({
  selector: 'app-proyecto-form',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, ProyectoIconoComponent],
  templateUrl: './proyecto-form.component.html',
  styles: [`
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
  @Input() submitLabel = 'Guardar';
  @Output() submitted = new EventEmitter<CreateProyectoDto>();

  form: CreateProyectoDto = this.empty();

  readonly estados: { value: EstadoProyecto; label: string }[] = [
    { value: 'borrador',      label: 'Borrador'      },
    { value: 'planificacion', label: 'Planificación' },
    { value: 'activo',        label: 'Activo'        },
    { value: 'en_pausa',      label: 'En pausa'      },
    { value: 'en_revision',   label: 'En revisión'   },
    { value: 'cerrado',       label: 'Cerrado'       },
    { value: 'cancelado',     label: 'Cancelado'     },
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
            centro_costo_id: asId(this.initial.centro_costo_id),
            tipo_proyecto_id: this.initial.tipo_proyecto_id
              ? asId(typeof this.initial.tipo_proyecto_id === 'object' ? (this.initial.tipo_proyecto_id as TipoProyecto)._id : this.initial.tipo_proyecto_id)
              : '',
            codigo:         this.initial.codigo,
            nombre:         this.initial.nombre,
            descripcion:    this.initial.descripcion ?? '',
            estado:         this.initial.estado,
            fecha_inicio:   this.initial.fecha_inicio ?? '',
            fecha_fin:      this.initial.fecha_fin ?? '',
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
    this.form.centro_costo_id = '';
  }

  submit(): void {
    const dto = { ...this.form };
    if (!dto.tipo_proyecto_id) delete dto.tipo_proyecto_id;
    if (!dto.fecha_inicio) delete dto.fecha_inicio;
    if (!dto.fecha_fin) delete dto.fecha_fin;
    this.submitted.emit(dto);
  }

  private empty(): CreateProyectoDto {
    return { cliente_id: '', centro_costo_id: '', tipo_proyecto_id: '', codigo: '', nombre: '', descripcion: '', estado: 'borrador', fecha_inicio: '', fecha_fin: '' };
  }
}
