import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Proyecto, TipoProyecto } from '../../../../shared/models/proyecto.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { asId } from '../../../../shared/utils';
import { ProyectoIconoComponent } from '../proyecto-icono/proyecto-icono.component';

const ESTADO_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  borrador:      { label: 'Borrador',      color: '#6b7280', bg: 'rgba(107,114,128,.12)' },
  planificacion: { label: 'Planificación', color: '#64748b', bg: 'rgba(100,116,139,.12)' },
  activo:        { label: 'Activo',        color: '#16a34a', bg: 'rgba(22,163,74,.12)'   },
  en_pausa:      { label: 'En pausa',      color: '#d97706', bg: 'rgba(217,119,6,.12)'   },
  en_revision:   { label: 'En revisión',   color: '#7c3aed', bg: 'rgba(124,58,237,.12)'  },
  cerrado:       { label: 'Cerrado',       color: '#9ca3af', bg: 'rgba(156,163,175,.12)' },
  cancelado:     { label: 'Cancelado',     color: '#dc2626', bg: 'rgba(220,38,38,.12)'   },
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
      background: #fff;
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
      color: #1f2937;
    }
    .grupo-title svg { color: #0095d6; flex-shrink: 0; }
    .grupo-count {
      font-size: .78rem;
      font-weight: 600;
      color: #0095d6;
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
      border: 1px solid rgba(34,33,33,.1);
      border-radius: 12px;
      padding: 1rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: .5rem;
      background: #fff;
      transition: box-shadow .15s, border-color .15s;
    }
    .proyecto-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,.08); border-color: rgba(34,33,33,.2); }

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
      color: #1f2937;
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
      color: #6b7280;
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
      color: #6b7280;
    }
    .proyecto-fechas svg { flex-shrink: 0; }
    .btn-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid rgba(34,33,33,.15);
      background: transparent;
      color: #6b7280;
      cursor: pointer;
      transition: all .15s;
    }
    .btn-icon:hover { border-color: rgba(34,33,33,.3); background: rgba(34,33,33,.04); color: #374151; }
    .btn-icon-danger { border-color: rgba(239,68,68,.25); color: #ef4444; }
    .btn-icon-danger:hover { border-color: rgba(239,68,68,.4); background: rgba(239,68,68,.06); color: #dc2626; }
    .proyecto-acciones { display: flex; gap: .4rem; }
  `],
})
export class ProyectosListComponent {
  @Input() proyectos: Proyecto[]    = [];
  @Input() clientes:  Cliente[]     = [];
  @Input() centros:   CentroCosto[] = [];
  @Input() tipos:     TipoProyecto[] = [];
  @Input() seleccionadoId: string | null = null;
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

  tipoDeProyecto(p: Proyecto): TipoProyecto | null {
    if (!p.tipo_proyecto_id) return null;
    if (typeof p.tipo_proyecto_id === 'object') return p.tipo_proyecto_id as TipoProyecto;
    return this.tipos.find(t => t._id === p.tipo_proyecto_id) ?? null;
  }

  estadoChip(estado: string) { return ESTADO_CHIP[estado] ?? ESTADO_CHIP['borrador']; }

  formatFecha(iso?: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${parseInt(d)} ${MESES[parseInt(m) - 1]} ${y}`;
  }
}
