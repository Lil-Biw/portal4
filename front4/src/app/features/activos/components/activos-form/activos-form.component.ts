import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Activo, CreateActivoDto } from '../../../../shared/models/activo.model';
import { CentroCosto } from '../../../../shared/models/centro.model';

@Component({
  selector: 'app-activos-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form class="form-grid" (ngSubmit)="enviar()">
      @if (!centroFijo) {
        <div class="field">
          <label>Centro de costos *</label>
          <select [(ngModel)]="form.centro_costo_id" name="centro_costo_id" required>
            <option value="">Selecciona un centro</option>
            @for (c of centros; track c._id) {
              <option [value]="c._id">{{ c.nombre }}</option>
            }
          </select>
        </div>
      } @else {
        <div class="field">
          <label>Centro de costos</label>
          <input type="text" [value]="centroFijo.nombre" disabled />
        </div>
      }
      <div class="field">
        <label>Nombre *</label>
        <input type="text" [(ngModel)]="form.nombre" name="nombre" required placeholder="Ej: Caldera principal" />
      </div>
      <div class="field">
        <label>Tipo de activo *</label>
        <input type="text" [(ngModel)]="form.tipo_activo" name="tipo_activo" required placeholder="Ej: Maquinaria, Vehículo, Infraestructura" />
      </div>
      <div class="field">
        <label>Descripción</label>
        <input type="text" [(ngModel)]="form.descripcion" name="descripcion" placeholder="Descripción opcional" />
      </div>
      <button type="submit" class="btn-primary" [disabled]="!form.nombre || !form.tipo_activo || (!centroFijo && !form.centro_costo_id)">
        {{ submitLabel }}
      </button>
    </form>
  `,
})
export class ActivosFormComponent implements OnChanges {
  @Input() initial: Activo | null = null;
  @Input() centroFijo: CentroCosto | null = null;
  @Input() centros: CentroCosto[] = [];
  @Input() submitLabel = 'Guardar activo';
  @Output() submitted = new EventEmitter<CreateActivoDto>();

  form: CreateActivoDto = { nombre: '', tipo_activo: '', centro_costo_id: '', descripcion: '' };

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.initial) {
      this.form = {
        nombre: this.initial.nombre,
        tipo_activo: this.initial.tipo_activo,
        centro_costo_id: this.initial.centro_costo_id,
        descripcion: this.initial.descripcion ?? '',
      };
    } else {
      this.form = {
        nombre: '',
        tipo_activo: '',
        centro_costo_id: this.centroFijo?._id ?? '',
        descripcion: '',
      };
    }
    if (this.centroFijo) {
      this.form.centro_costo_id = this.centroFijo._id;
    }
  }

  enviar(): void {
    if (!this.form.nombre || !this.form.tipo_activo || !this.form.centro_costo_id) return;
    const dto: CreateActivoDto = {
      nombre:          this.form.nombre.trim(),
      tipo_activo:     this.form.tipo_activo.trim(),
      centro_costo_id: this.form.centro_costo_id,
    };
    if (this.form.descripcion?.trim()) dto.descripcion = this.form.descripcion.trim();
    this.submitted.emit(dto);
  }
}
