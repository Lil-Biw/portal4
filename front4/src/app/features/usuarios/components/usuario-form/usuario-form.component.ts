import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { Usuario, CreateUsuarioDto, RolUsuario } from '../../../../shared/models/usuario.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import {
  PermisosUsuario,
  permisosIguales,
  permisosPorDefectoSegunRol,
} from '../../../../shared/models/permisos.model';
import { asId } from '../../../../shared/utils';

export interface UsuarioFormOutput {
  dto: CreateUsuarioDto;
}

type RolOpcion = RolUsuario | 'personalizado';

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
  @Input() esAdminCliente = false;
  @Output() submitted = new EventEmitter<UsuarioFormOutput>();
  @Output() clienteChange = new EventEmitter<string>();
  @Output() centroToggle = new EventEmitter<{ centroId: string; checked: boolean }>();

  form: CreateUsuarioDto = this.empty();

  rolUI: RolOpcion = 'usuario';

  private readonly todosLosRoles: { value: RolUsuario; label: string }[] = [
    { value: 'usuario', label: 'Usuario' },
    { value: 'admin_smartclarity', label: 'Admin SmartClarity' },
  ];

  get roles() {
    return this.esAdminCliente
      ? [{ value: 'usuario' as RolUsuario, label: 'Usuario' }]
      : this.todosLosRoles;
  }

  get rolOpciones(): { value: RolOpcion; label: string }[] {
    if (!this.isEdit) return this.roles;
    return [...this.roles, { value: 'personalizado', label: 'Personalizado' }];
  }

  ngOnChanges(): void {
    if (this.initial) {
      this.form = {
        cliente_id: asId(this.initial.cliente_id),
        nombre: this.initial.nombre,
        email: this.initial.email,
        rol: this.initial.rol,
        permiso_acceso: this.initial.permiso_acceso,
        permisos: structuredClone(this.initial.permisos ?? {}),
      };
      // Si los permisos actuales no son los por defecto del rol, mostramos
      // "Personalizado" para que no se reseteen al guardar sin tocar nada.
      const actuales = this.form.permisos;
      this.rolUI = permisosIguales(actuales, permisosPorDefectoSegunRol(this.initial.rol))
        ? this.initial.rol
        : 'personalizado';
    }
  }

  get centrosFiltrados(): CentroCosto[] {
    if (!this.form.cliente_id) return [];
    return this.centros.filter((c) => asId(c.cliente_id) === this.form.cliente_id);
  }

  onClienteChange(id: string): void {
    this.clienteChange.emit(id);
  }

  onRolChange(v: RolOpcion): void {
    this.rolUI = v;
    if (v === 'personalizado') {
      this.form.rol = this.initial?.rol ?? 'usuario';
      this.form.permisos = structuredClone(this.initial?.permisos ?? {});
      return;
    }
    this.form.rol = v;
    // Cambiar el rol aplica los permisos por defecto de ese rol.
    this.form.permisos = structuredClone(permisosPorDefectoSegunRol(v));
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
    return { cliente_id: '', nombre: '', email: '', rol: 'usuario', permiso_acceso: 'ver' };
  }
}
