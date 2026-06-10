import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Usuario } from '../../../../shared/models/usuario.model';

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './usuarios-list.component.html',
  styles: [`
    .rol-super-admin { border-left: 3px solid #f59e0b !important; background: rgba(245,158,11,.06) !important; }
    .rol-admin        { border-left: 3px solid #0095d6 !important; background: rgba(0,149,214,.06) !important; }
  `],
})
export class UsuariosListComponent {
  @Input() usuarios: Usuario[] = [];
  @Input() seleccionadoId: string | null = null;
  @Output() editado   = new EventEmitter<Usuario>();
  @Output() eliminado = new EventEmitter<string>();
}
