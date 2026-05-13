import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { asId } from '../../../../shared/utils';

interface GrupoEmpresa { empresa: Cliente; centros: CentroCosto[]; }

@Component({
  selector: 'app-centros-list',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './centros-list.component.html',
})
export class CentrosListComponent {
  @Input() centros: CentroCosto[] = [];
  @Input() clientes: Cliente[] = [];
  @Input() seleccionadoId: string | null = null;
  @Output() editado   = new EventEmitter<CentroCosto>();
  @Output() eliminado = new EventEmitter<string>();

  get grupos(): GrupoEmpresa[] {
    const map = new Map<string, GrupoEmpresa>();

    for (const centro of this.centros) {
      const key = asId(centro.cliente_id);
      if (!map.has(key)) {
        const empresa = this.clientes.find(x => asId(x._id) === key);
        if (!empresa) continue;
        map.set(key, { empresa, centros: [] });
      }
      map.get(key)!.centros.push(centro);
    }

    return Array.from(map.values());
  }
}
