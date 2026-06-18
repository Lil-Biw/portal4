import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, signal } from '@angular/core';
import { Activo, TipoActivo } from '../../../../shared/models/activo.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { asId } from '../../../../shared/utils';
import { ActivoIconoComponent } from '../activo-icono/activo-icono.component';

interface GrupoCentro  { centro: CentroCosto; activos: Activo[]; }
interface GrupoEmpresa { empresa: Cliente; centros: GrupoCentro[]; }

@Component({
  selector: 'app-activos-list',
  standalone: true,
  imports: [ActivoIconoComponent],
  templateUrl: './activos-list.component.html',
})
export class ActivosListComponent implements OnChanges {
  @Input() activos: Activo[]      = [];
  @Input() centros: CentroCosto[] = [];
  @Input() clientes: Cliente[]    = [];
  @Input() tipos: TipoActivo[]    = [];
  @Input() mostrarAcciones = true;
  @Output() editado   = new EventEmitter<Activo>();
  @Output() eliminado = new EventEmitter<string>();

  private _activos  = signal<Activo[]>([]);
  private _centros  = signal<CentroCosto[]>([]);
  private _clientes = signal<Cliente[]>([]);
  private _tipos    = signal<TipoActivo[]>([]);

  ngOnChanges(_: SimpleChanges): void {
    this._activos.set(this.activos);
    this._centros.set(this.centros);
    this._clientes.set(this.clientes);
    this._tipos.set(this.tipos);
  }

  grupos = computed((): GrupoEmpresa[] => {
    const map = new Map<string, GrupoEmpresa>();

    for (const activo of this._activos()) {
      const centro = this._centros().find(c => asId(c._id) === asId(activo.centro_costo_id));
      if (!centro) continue;

      const empresaId = asId(centro.cliente_id);
      const empresa   = this._clientes().find(e => asId(e._id) === empresaId);
      if (!empresa) continue;

      if (!map.has(empresaId)) {
        map.set(empresaId, { empresa, centros: [] });
      }
      const ge = map.get(empresaId)!;

      let gc = ge.centros.find(x => asId(x.centro._id) === asId(centro._id));
      if (!gc) {
        gc = { centro, activos: [] };
        ge.centros.push(gc);
      }
      gc.activos.push(activo);
    }

    return Array.from(map.values());
  });

  totalActivos(ge: GrupoEmpresa): number {
    return ge.centros.reduce((sum, gc) => sum + gc.activos.length, 0);
  }

  centroNombre(a: Activo): string {
    return this._centros().find(c => asId(c._id) === asId(a.centro_costo_id))?.nombre ?? '';
  }

  tipoDeActivo(a: Activo): TipoActivo | null {
    if (typeof a.tipo_activo_id === 'object') return a.tipo_activo_id as TipoActivo;
    return this._tipos().find(t => t._id === asId(a.tipo_activo_id as string)) ?? null;
  }
}
