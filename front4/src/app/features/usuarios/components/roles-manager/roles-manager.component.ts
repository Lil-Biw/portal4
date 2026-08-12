import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PermisosPanelComponent } from '../../../../shared/components/permisos-panel/permisos-panel.component';
import { CreateRolDto, PermisosUsuario, Rol, UpdateRolDto, contarPermisosActivos } from '../../../../shared/models/permisos.model';

type Vista = 'lista' | 'editar';

@Component({
  selector: 'app-roles-manager',
  standalone: true,
  imports: [FormsModule, PermisosPanelComponent],
  templateUrl: './roles-manager.component.html',
  styles: [`
    .rm-lista { display: flex; flex-direction: column; gap: .5rem; }
    .rm-row {
      display: flex; align-items: center; gap: .75rem;
      padding: .7rem .9rem; border: 1px solid rgba(34,33,33,.1); border-radius: 10px;
    }
    .rm-row-info { flex: 1; min-width: 0; }
    .rm-row-nombre { font-size: .9rem; font-weight: 700; color: #1f2937; }
    .rm-row-contador { font-size: .78rem; color: #6b7280; }
    .rm-row-acciones { display: flex; gap: .4rem; }
    .rm-nuevo { margin-top: .4rem; }
    .rm-empty { font-size: .85rem; color: #9ca3af; text-align: center; padding: 1rem 0; }

    .rm-nombre-field { display: flex; flex-direction: column; gap: .3rem; margin-bottom: 1.1rem; }
    .rm-nombre-field label { font-size: .78rem; font-weight: 600; color: #374151; }
    .rm-nombre-field input {
      padding: .55rem .75rem; border-radius: 8px; border: 1px solid rgba(34,33,33,.2);
      font-size: .9rem; font-family: inherit;
    }
    .rm-footer {
      display: flex; align-items: center; justify-content: flex-end; gap: .6rem;
      margin-top: 1.2rem; padding-top: .9rem; border-top: 1px solid rgba(34,33,33,.1);
    }
  `],
})
export class RolesManagerComponent {
  @Input() roles: Rol[] = [];
  @Output() crear = new EventEmitter<CreateRolDto>();
  @Output() editar = new EventEmitter<{ id: string; dto: UpdateRolDto }>();
  @Output() eliminar = new EventEmitter<string>();

  vista = signal<Vista>('lista');
  rolEditandoId = signal<string | null>(null);
  nombreForm = '';
  valoresForm: PermisosUsuario = {};

  contadorDe(rol: Rol): { activos: number; total: number } {
    return contarPermisosActivos(rol.permisos, true);
  }

  abrirNuevo(): void {
    this.rolEditandoId.set(null);
    this.nombreForm = '';
    this.valoresForm = {};
    this.vista.set('editar');
  }

  abrirEditar(rol: Rol): void {
    this.rolEditandoId.set(rol._id);
    this.nombreForm = rol.nombre;
    this.valoresForm = structuredClone(rol.permisos);
    this.vista.set('editar');
  }

  volver(): void {
    this.vista.set('lista');
  }

  onValoresChange(v: PermisosUsuario): void {
    this.valoresForm = v;
  }

  guardar(): void {
    const dto = { nombre: this.nombreForm, permisos: this.valoresForm };
    const id = this.rolEditandoId();
    if (id) this.editar.emit({ id, dto });
    else this.crear.emit(dto);
    this.vista.set('lista');
  }
}
