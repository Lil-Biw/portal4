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

  // El rol no se puede cambiar desde este formulario: cambiarlo puede
  // encerrar al propio admin que edita (bajarse de admin_smartclarity a
  // usuario deja sin acceso a esta misma pantalla). Cambios de rol se hacen
  // desde el flujo dedicado (crear administrador / Roles).
  rolLabel(rol: RolUsuario | undefined): string {
    if (rol === 'super_admin') return 'Super Admin';
    if (rol === 'admin_smartclarity') return 'Admin SmartClarity';
    return 'Usuario';
  }

  ngOnChanges(): void {
    if (this.initial) {
      this.form = {
        cliente_id: asId(this.initial.cliente_id),
        nombre: this.initial.nombre,
        email: this.initial.email,
        rol: this.initial.rol,
        permisos: structuredClone(this.initial.permisos ?? {}),
      };
    }
  }

  get centrosFiltrados(): CentroCosto[] {
    if (!this.form.cliente_id) return [];
    return this.centros.filter((c) => asId(c.cliente_id) === this.form.cliente_id);
  }

  onClienteChange(id: string): void {
    this.clienteChange.emit(id);
  }

  submit(): void {
    const dto: CreateUsuarioDto = {
      ...this.form,
      centros_asignados: this.centrosSeleccionados,
    };
    // En alta el backend aplica los permisos por defecto; no enviar el campo.
    if (!this.isEdit) delete dto.permisos;
    this.submitted.emit({ dto });
  }

  private empty(): CreateUsuarioDto {
    return { cliente_id: '', nombre: '', email: '', rol: 'usuario' };
  }
}
