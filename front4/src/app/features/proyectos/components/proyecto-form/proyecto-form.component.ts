import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor } from '@angular/common';
import { Proyecto, CreateProyectoDto, EstadoProyecto } from '../../../../shared/models/proyecto.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { asId } from '../../../../shared/utils';

@Component({
  selector: 'app-proyecto-form',
  standalone: true,
  imports: [FormsModule, NgFor],
  templateUrl: './proyecto-form.component.html',
})
export class ProyectoFormComponent implements OnChanges {
  @Input() initial: Proyecto | null = null;
  @Input() clientes: Cliente[] = [];
  @Input() centros: CentroCosto[] = [];
  @Input() submitLabel = 'Guardar';
  @Output() submitted = new EventEmitter<CreateProyectoDto>();

  form: CreateProyectoDto = this.empty();

  readonly estados: { value: EstadoProyecto; label: string }[] = [
    { value: 'borrador', label: 'Borrador' },
    { value: 'activo',   label: 'Activo'   },
    { value: 'cerrado',  label: 'Cerrado'  },
  ];

  ngOnChanges(): void {
    this.form = this.initial
      ? {
          cliente_id:     asId(this.initial.cliente_id),
          centro_costo_id: asId(this.initial.centro_costo_id),
          codigo:         this.initial.codigo,
          nombre:         this.initial.nombre,
          descripcion:    this.initial.descripcion ?? '',
          estado:         this.initial.estado,
          fecha_inicio:   this.initial.fecha_inicio ?? '',
          fecha_fin:      this.initial.fecha_fin ?? '',
        }
      : this.empty();
  }

  get centrosFiltrados(): CentroCosto[] {
    if (!this.form.cliente_id) return [];
    return this.centros.filter(c => asId(c.cliente_id) === this.form.cliente_id);
  }

  onClienteChange(): void {
    this.form.centro_costo_id = '';
  }

  submit(): void { this.submitted.emit(this.form); }

  private empty(): CreateProyectoDto {
    return { cliente_id: '', centro_costo_id: '', codigo: '', nombre: '', descripcion: '', estado: 'borrador', fecha_inicio: '', fecha_fin: '' };
  }
}
