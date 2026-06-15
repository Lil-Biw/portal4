import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Cliente } from '../../../../shared/models/cliente.model';

@Component({
  selector: 'app-clientes-list',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './clientes-list.component.html',
})
export class ClientesListComponent {
  @Input() clientes: Cliente[] = [];
  @Input() seleccionadoId: string | null = null;
  @Input() mostrarVerFicha = true;
  @Output() editado      = new EventEmitter<Cliente>();
  @Output() eliminado    = new EventEmitter<string>();
  @Output() verFicha     = new EventEmitter<Cliente>();
  @Output() editarScore  = new EventEmitter<Cliente>();
}
