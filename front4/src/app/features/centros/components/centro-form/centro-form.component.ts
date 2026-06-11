import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor } from '@angular/common';
import { CentroCosto, CreateCentroDto } from '../../../../shared/models/centro.model';
import { Cliente } from '../../../../shared/models/cliente.model';

@Component({
  selector: 'app-centro-form',
  standalone: true,
  imports: [FormsModule, NgFor],
  templateUrl: './centro-form.component.html',
})
export class CentroFormComponent implements OnChanges {
  @Input() initial: CentroCosto | null = null;
  @Input() clientes: Cliente[] = [];
  @Input() submitLabel = 'Guardar';
  @Output() submitted = new EventEmitter<CreateCentroDto>();

  form: CreateCentroDto = this.empty();

  ngOnChanges(): void {
    this.form = this.initial
      ? {
          cliente_id: this.initial.cliente_id,
          codigo: this.initial.codigo,
          nombre: this.initial.nombre,
          descripcion: this.initial.descripcion ?? '',
          ubicacion_direccion: this.initial.ubicacion_direccion ?? '',
          ubicacion_ciudad: this.initial.ubicacion_ciudad ?? '',
          ubicacion_region: this.initial.ubicacion_region ?? '',
          ubicacion_pais: this.initial.ubicacion_pais ?? 'Chile',
          ubicacion_latitud: this.initial.ubicacion_latitud,
          ubicacion_longitud: this.initial.ubicacion_longitud,
        }
      : this.empty();
  }

  submit(): void { this.submitted.emit(this.form); }

  private empty(): CreateCentroDto {
    return { cliente_id: '', codigo: '', nombre: '', descripcion: '', ubicacion_direccion: '', ubicacion_ciudad: '', ubicacion_region: '', ubicacion_pais: 'Chile', ubicacion_latitud: undefined, ubicacion_longitud: undefined };
  }
}
