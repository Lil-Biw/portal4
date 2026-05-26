import { Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';

import { CentroCosto } from '../../../../shared/models/centro.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { asId } from '../../../../shared/utils';

interface GrupoEmpresa { empresa: Cliente; centros: CentroCosto[]; }

@Component({
  selector: 'app-centros-list',
  standalone: true,
  imports: [],
  templateUrl: './centros-list.component.html',
})
export class CentrosListComponent implements OnChanges {
  @Input() centros: CentroCosto[] = [];
  @Input() clientes: Cliente[] = [];
  @Input() seleccionadoId: string | null = null;
  @Output() editado       = new EventEmitter<CentroCosto>();
  @Output() eliminado     = new EventEmitter<string>();
  @Output() verCentro     = new EventEmitter<CentroCosto>();
  @Output() agregarActivo = new EventEmitter<CentroCosto>();

  private _centros  = signal<CentroCosto[]>([]);
  private _clientes = signal<Cliente[]>([]);

  ngOnChanges(): void {
    this._centros.set(this.centros);
    this._clientes.set(this.clientes);
  }

  grupos = computed((): GrupoEmpresa[] => {
    const map = new Map<string, GrupoEmpresa>();
    for (const centro of this._centros()) {
      const key = asId(centro.cliente_id);
      if (!map.has(key)) {
        const empresa = this._clientes().find(x => asId(x._id) === key);
        if (!empresa) continue;
        map.set(key, { empresa, centros: [] });
      }
      map.get(key)!.centros.push(centro);
    }
    return Array.from(map.values());
  });
}
