import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Usuario } from '../../../../shared/models/usuario.model';

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './usuarios-list.component.html',
})
export class UsuariosListComponent {
  @Input() usuarios: Usuario[] = [];
  @Input() seleccionadoId: string | null = null;
  @Output() editado   = new EventEmitter<Usuario>();
  @Output() eliminado = new EventEmitter<string>();
}
