import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Activo } from '../../../../shared/models/activo.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { asId } from '../../../../shared/utils';

@Component({
  selector: 'app-activos-list',
  standalone: true,
  template: `
    @if (activos.length === 0) {
      <p class="empty">Sin activos registrados.</p>
    } @else {
      <div class="list">
        @for (a of activos; track a._id) {
          <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:1rem">
            <div>
              <strong style="display:block;font-size:.9rem;color:#1f2937">{{ a.nombre }}</strong>
              <span style="font-size:.78rem;color:#6b7280">{{ a.tipo_activo }}</span>
              @if (centroNombre(a)) {
                <span style="display:block;font-size:.75rem;color:#0095d6;font-weight:500">{{ centroNombre(a) }}</span>
              }
              @if (a.descripcion) {
                <span style="display:block;font-size:.78rem;color:#9ca3af">{{ a.descripcion }}</span>
              }
            </div>
            @if (mostrarAcciones) {
              <div style="display:flex;gap:.5rem;flex-shrink:0">
                <button class="btn-ghost btn-sm" (click)="editado.emit(a)">Editar</button>
                <button class="btn-danger btn-sm" (click)="eliminado.emit(a._id)">Eliminar</button>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class ActivosListComponent {
  @Input() activos: Activo[] = [];
  @Input() centros: CentroCosto[] = [];
  @Input() mostrarAcciones = true;
  @Output() editado   = new EventEmitter<Activo>();
  @Output() eliminado = new EventEmitter<string>();

  centroNombre(a: Activo): string {
    return this.centros.find(c => asId(c._id) === asId(a.centro_costo_id))?.nombre ?? '';
  }
}
