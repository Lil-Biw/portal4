import { Injectable, signal } from '@angular/core';
import { Cliente } from '../shared/models/cliente.model';
import { CentroCosto } from '../shared/models/centro.model';
import { Proyecto } from '../shared/models/proyecto.model';

@Injectable({ providedIn: 'root' })
export class ConsumidorContextService {
  readonly empresaSeleccionada  = signal<Cliente | null>(null);
  readonly centroSeleccionado   = signal<CentroCosto | null>(null);
  readonly proyectoSeleccionado = signal<Proyecto | null>(null);

  seleccionar(cliente: Cliente | null): void {
    this.empresaSeleccionada.set(cliente);
    this.centroSeleccionado.set(null);
    this.proyectoSeleccionado.set(null);
  }

  seleccionarCentro(centro: CentroCosto | null): void {
    this.centroSeleccionado.set(centro);
  }

  seleccionarProyecto(proyecto: Proyecto | null): void {
    this.proyectoSeleccionado.set(proyecto);
  }
}
