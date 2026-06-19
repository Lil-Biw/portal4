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
  styles: [`
    .grupo-header-left { display: flex; align-items: center; gap: .5rem; }

    .grupo-count-text {
      font-size: .8rem;
      font-weight: 600;
      color: #0095d6;
    }

    .centro-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: #f3f4f6;
      border-radius: 8px;
      flex-shrink: 0;
    }

    .centro-meta {
      font-size: .8rem;
      color: #6b7280;
    }

    .btn-ver {
      display: inline-flex;
      align-items: center;
      gap: .35rem;
      white-space: nowrap;
    }

    .btn-icon-sq {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 1px solid #d1d5db;
      border-radius: 7px;
      background: none;
      cursor: pointer;
      color: #6b7280;
      transition: border-color .15s, color .15s, background .15s;
    }
    .btn-icon-sq:hover { border-color: #0095d6; color: #0095d6; background: rgba(0,149,214,.06); }

    .btn-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: none;
      background: none;
      cursor: pointer;
      color: #9ca3af;
      border-radius: 6px;
      transition: color .15s, background .15s;
    }
    .btn-action:hover { color: #374151; background: rgba(0,0,0,.06); }
    .btn-action-danger { color: #f87171; }
    .btn-action-danger:hover { color: #ef4444; background: rgba(239,68,68,.08); }

    .score-block { text-align: center; flex-shrink: 0; min-width: 54px; }
    .score-label { font-size: .6rem; font-weight: 700; letter-spacing: .07em; color: #9ca3af; text-transform: uppercase; display: block; }
    .score-num { font-size: 1.3rem; font-weight: 800; line-height: 1.1; }
    .score-empty { font-size: .72rem; color: #d1d5db; font-weight: 600; }
  `],
})
export class CentrosListComponent implements OnChanges {
  @Input() centros: CentroCosto[] = [];
  @Input() clientes: Cliente[] = [];
  @Input() seleccionadoId: string | null = null;
  @Input() scoresPorCentro: Map<string, number> = new Map();
  @Output() editado       = new EventEmitter<CentroCosto>();
  @Output() eliminado     = new EventEmitter<string>();
  @Output() verCentro     = new EventEmitter<CentroCosto>();
  @Output() agregarActivo = new EventEmitter<CentroCosto>();
  @Output() editarScore   = new EventEmitter<CentroCosto>();

  private _centros  = signal<CentroCosto[]>([]);
  private _clientes = signal<Cliente[]>([]);

  ngOnChanges(): void {
    this._centros.set(this.centros);
    this._clientes.set(this.clientes);
  }

  getScoreColor(score: number): string {
    if (score >= 75) return '#16a34a';
    if (score >= 50) return '#0095d6';
    return '#dc2626';
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
