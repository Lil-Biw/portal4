import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgFor, NgIf, SlicePipe } from '@angular/common';
import { Proyecto } from '../../../../shared/models/proyecto.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { asId } from '../../../../shared/utils';

const ESTADO_CHIP: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: '#6b7280' },
  activo:   { label: 'Activo',   color: '#0095d6' },
  cerrado:  { label: 'Cerrado',  color: '#9ca3af' },
};

interface GrupoCentro  { centro: CentroCosto; proyectos: Proyecto[]; }
interface GrupoEmpresa { empresa: Cliente; centros: GrupoCentro[]; }

@Component({
  selector: 'app-proyectos-list',
  standalone: true,
  imports: [NgFor, NgIf, SlicePipe],
  templateUrl: './proyectos-list.component.html',
})
export class ProyectosListComponent {
  @Input() proyectos: Proyecto[]    = [];
  @Input() clientes:  Cliente[]     = [];
  @Input() centros:   CentroCosto[] = [];
  @Input() seleccionadoId: string | null = null;
  @Output() editado   = new EventEmitter<Proyecto>();
  @Output() eliminado = new EventEmitter<string>();

  get grupos(): GrupoEmpresa[] {
    const empresaMap = new Map<string, GrupoEmpresa>();

    for (const p of this.proyectos) {
      const empKey    = asId(p.cliente_id);
      const centroKey = asId(p.centro_costo_id);

      if (!empresaMap.has(empKey)) {
        const empresa = this.clientes.find(x => asId(x._id) === empKey);
        if (!empresa) continue;
        empresaMap.set(empKey, { empresa, centros: [] });
      }
      const grupoEmp = empresaMap.get(empKey)!;

      let grupoCentro = grupoEmp.centros.find(gc => asId(gc.centro._id) === centroKey);
      if (!grupoCentro) {
        const centro = this.centros.find(x => asId(x._id) === centroKey);
        if (!centro) continue;
        grupoCentro = { centro, proyectos: [] };
        grupoEmp.centros.push(grupoCentro);
      }
      grupoCentro.proyectos.push(p);
    }

    return Array.from(empresaMap.values());
  }

  estadoChip(estado: string) { return ESTADO_CHIP[estado] ?? ESTADO_CHIP['borrador']; }
}
