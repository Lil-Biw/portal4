import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Proyecto, TipoProyecto } from '../../../../shared/models/proyecto.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { asId } from '../../../../shared/utils';
import { ProyectoIconoComponent } from '../proyecto-icono/proyecto-icono.component';

const ESTADO_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  estancado:            { label: 'Estancado',              color: 'var(--danger)', bg: 'var(--danger-bg)'  },
  nuevo_sin_oc:          { label: 'Nuevos por Programar / Sin OC',         color: 'var(--fg-4)', bg: 'rgba(107,114,128,.12)' },
  nuevo_con_oc:          { label: 'Nuevos por Programar / Con OC',         color: 'var(--fg-3)', bg: 'rgba(100,116,139,.12)' },
  en_ejecucion:          { label: 'En ejecución',                         color: 'var(--ok)', bg: 'var(--ok-bg)'  },
  cierre_pendiente:      { label: 'Cierre pendiente / Validación Interna', color: '#7c3aed', bg: 'rgba(124,58,237,.12)' },
  finalizado_facturar:   { label: 'Finalizado / Listo para facturar',      color: 'var(--warn)', bg: 'var(--warn-bg)'  },
  finalizado_facturado:  { label: 'Finalizado y facturado', color: '#0d9488', bg: 'rgba(13,148,136,.12)' },
};

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

interface GrupoEmpresa { empresa: Cliente; proyectos: Proyecto[]; }

@Component({
  selector: 'app-proyectos-list',
  standalone: true,
  imports: [ProyectoIconoComponent],
  templateUrl: './proyectos-list.component.html',
  styles: [`
    .grupos { display: flex; flex-direction: column; gap: 1.5rem; }

    .grupo-empresa {
      border: 1.5px solid rgba(0,149,214,.2);
      border-radius: 16px;
      overflow: hidden;
      background: var(--bg-0);
    }

    .grupo-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: .75rem 1.25rem;
      background: rgba(0,149,214,.05);
      border-bottom: 1px solid rgba(0,149,214,.15);
    }
    .grupo-title {
      display: flex;
      align-items: center;
      gap: .5rem;
      font-weight: 700;
      font-size: .9rem;
      color: var(--fg-2);
    }
    .grupo-title svg { color: var(--sc-cyan); flex-shrink: 0; }
    .grupo-count {
      font-size: .78rem;
      font-weight: 600;
      color: var(--sc-cyan);
    }

    .proyecto-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      padding: 1rem;
    }
    @media (max-width: 700px) {
      .proyecto-grid { grid-template-columns: 1fr; }
    }

    .proyecto-card {
      border: 1px solid var(--border-default);
      border-radius: 12px;
      padding: 1rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: .5rem;
      background: var(--bg-0);
      transition: box-shadow .15s, border-color .15s;
    }
    .proyecto-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,.08); border-color: var(--border-strong); }

    .proyecto-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: .5rem;
    }
    .proyecto-nombre-wrap { display: flex; align-items: center; gap: .4rem; min-width: 0; }
    .proyecto-nombre {
      font-weight: 700;
      font-size: .95rem;
      color: var(--fg-2);
      line-height: 1.3;
    }
    .estado-badge {
      padding: .2rem .65rem;
      border-radius: 999px;
      font-size: .72rem;
      font-weight: 700;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .proyecto-meta {
      margin: 0;
      font-size: .8rem;
      color: var(--fg-4);
    }
    .proyecto-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .5rem;
      margin-top: .25rem;
    }
    .proyecto-fechas {
      display: flex;
      align-items: center;
      gap: .35rem;
      font-size: .8rem;
      color: var(--fg-4);
    }
    .proyecto-fechas svg { flex-shrink: 0; }
    .btn-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid var(--border-default);
      background: transparent;
      color: var(--fg-4);
      cursor: pointer;
      transition: all .15s;
    }
    .btn-icon:hover { border-color: var(--border-strong); background: rgba(34,33,33,.04); color: var(--fg-2); }
    .btn-icon-danger { border-color: rgba(239,68,68,.25); color: var(--danger); }
    .btn-icon-danger:hover { border-color: rgba(239,68,68,.4); background: var(--danger-bg); color: var(--danger); }
    .proyecto-acciones { display: flex; gap: .4rem; }
  `],
})
export class ProyectosListComponent {
  @Input() proyectos: Proyecto[]    = [];
  @Input() clientes:  Cliente[]     = [];
  @Input() centros:   CentroCosto[] = [];
  @Input() tipos:     TipoProyecto[] = [];
  @Input() seleccionadoId: string | null = null;
  @Input() puedeEditar = true;
  @Input() puedeEliminar = true;
  @Output() editado   = new EventEmitter<Proyecto>();
  @Output() eliminado = new EventEmitter<string>();

  get grupos(): GrupoEmpresa[] {
    const empresaMap = new Map<string, GrupoEmpresa>();

    for (const p of this.proyectos) {
      const empKey = asId(p.cliente_id);
      if (!empresaMap.has(empKey)) {
        const empresa = this.clientes.find(x => asId(x._id) === empKey);
        if (!empresa) continue;
        empresaMap.set(empKey, { empresa, proyectos: [] });
      }
      empresaMap.get(empKey)!.proyectos.push(p);
    }

    return Array.from(empresaMap.values()).sort((a, b) =>
      a.empresa.razon_social.localeCompare(b.empresa.razon_social)
    );
  }

  centroPorId(id: string): string {
    return this.centros.find(c => asId(c._id) === id)?.nombre ?? '';
  }

  centrosNombres(p: Proyecto): string {
    return (p.centro_costo_ids ?? [])
      .map(id => this.centroPorId(asId(id)))
      .filter(Boolean)
      .join(', ');
  }

  tipoDeProyecto(p: Proyecto): TipoProyecto | null {
    if (!p.tipo_proyecto_id) return null;
    if (typeof p.tipo_proyecto_id === 'object') return p.tipo_proyecto_id as TipoProyecto;
    return this.tipos.find(t => t._id === p.tipo_proyecto_id) ?? null;
  }

  estadoChip(estado: string) { return ESTADO_CHIP[estado] ?? ESTADO_CHIP['nuevo_sin_oc']; }

  formatFecha(iso?: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${parseInt(d)} ${MESES[parseInt(m) - 1]} ${y}`;
  }
}
