import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { Usuario, CreateUsuarioDto, RolUsuario } from '../../../../shared/models/usuario.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { asId } from '../../../../shared/utils';

export interface UsuarioFormOutput {
  dto: CreateUsuarioDto;
}

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  templateUrl: './usuario-form.component.html',
})
export class UsuarioFormComponent implements OnChanges {
  @Input() initial: Usuario | null = null;
  @Input() clientes: Cliente[] = [];
  @Input() centros: CentroCosto[] = [];
  @Input() centrosSeleccionados: string[] = [];
  @Input() submitLabel = 'Guardar';
  @Input() isEdit = false;
  @Output() submitted = new EventEmitter<UsuarioFormOutput>();
  @Output() clienteChange = new EventEmitter<string>();
  @Output() centroToggle = new EventEmitter<{ centroId: string; checked: boolean }>();

  form: CreateUsuarioDto = this.empty();

  readonly roles: { value: RolUsuario; label: string }[] = [
    { value: 'usuario',       label: 'Usuario'       },
    { value: 'admin_cliente', label: 'Admin cliente' },
  ];

  ngOnChanges(): void {
    if (this.initial) {
      this.form = {
        cliente_id:     asId(this.initial.cliente_id),
        nombre:         this.initial.nombre,
        email:          this.initial.email,
        rol:            this.initial.rol,
        permiso_acceso: this.initial.permiso_acceso,
      };
    }
  }

  get centrosFiltrados(): CentroCosto[] {
    if (!this.form.cliente_id) return [];
    return this.centros.filter(c => asId(c.cliente_id) === this.form.cliente_id);
  }

  onClienteChange(id: string): void { this.clienteChange.emit(id); }

  submit(): void {
    this.submitted.emit({
      dto: { ...this.form, centros_asignados: this.centrosSeleccionados },
    });
  }

  private empty(): CreateUsuarioDto {
    return { cliente_id: '', nombre: '', email: '', rol: 'usuario', permiso_acceso: 'ver' };
  }
}
