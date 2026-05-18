import { Injectable, signal } from '@angular/core';
import { Cliente } from '../shared/models/cliente.model';

@Injectable({ providedIn: 'root' })
export class ConsumidorContextService {
  readonly empresaSeleccionada = signal<Cliente | null>(null);

  seleccionar(cliente: Cliente | null): void {
    this.empresaSeleccionada.set(cliente);
  }
}
