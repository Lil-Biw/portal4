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
      color: var(--sc-cyan);
    }

    .centro-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: var(--bg-2);
      border-radius: 8px;
      flex-shrink: 0;
    }

    .centro-meta {
      font-size: .8rem;
      color: var(--fg-4);
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
      width: auto;
      height: 30px;
      padding: 0 .55rem;
      gap: .35rem;
      border: 1px solid var(--border-default);
      border-radius: 7px;
      background: none;
      cursor: pointer;
      color: var(--fg-4);
      font-size: .72rem;
      font-weight: 600;
      transition: border-color .15s, color .15s, background .15s;
    }
    .btn-icon-sq:hover { border-color: var(--sc-cyan); color: var(--sc-cyan); background: var(--sc-cyan-tint-6); }

    .btn-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: auto;
      height: 30px;
      padding: 0 .55rem;
      gap: .35rem;
      border: none;
      background: none;
      cursor: pointer;
      color: var(--fg-5);
      border-radius: 6px;
      font-size: .72rem;
      font-weight: 600;
      transition: color .15s, background .15s;
    }
    .btn-action:hover { color: var(--fg-2); background: rgba(0,0,0,.06); }
    .btn-action-danger { color: var(--danger); }
    .btn-action-danger:hover { color: var(--danger); background: var(--danger-bg); }

    .score-block { text-align: center; flex-shrink: 0; min-width: 54px; }
    .score-label { font-size: .6rem; font-weight: 700; letter-spacing: .07em; color: var(--fg-5); text-transform: uppercase; display: block; }
    .score-num { font-size: 1.3rem; font-weight: 800; line-height: 1.1; }
    .score-empty { font-size: .72rem; color: var(--fg-5); font-weight: 600; }
  `],
})
export class CentrosListComponent implements OnChanges {
  @Input() centros: CentroCosto[] = [];
  @Input() clientes: Cliente[] = [];
  @Input() seleccionadoId: string | null = null;
  @Input() scoresPorCentro: Map<string, number> = new Map();
  @Input() puedeEditar = true;
  @Input() puedeEliminar = true;
  @Input() puedeAgregarActivo = true;
  @Output() editado       = new EventEmitter<CentroCosto>();
  @Output() eliminado     = new EventEmitter<string>();
  @Output() verCentro     = new EventEmitter<CentroCosto>();
  @Output() agregarActivo = new EventEmitter<CentroCosto>();
  @Output() editarScore   = new EventEmitter<CentroCosto>();

  protected readonly asId = asId;

  private _centros  = signal<CentroCosto[]>([]);
  private _clientes = signal<Cliente[]>([]);

  ngOnChanges(): void {
    this._centros.set(this.centros);
    this._clientes.set(this.clientes);
  }

  getScoreColor(score: number): string {
    if (score >= 75) return '#2EAE6E';
    if (score >= 50) return '#00AEEF';
    return '#E5484D';
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
    return Array.from(map.values()).sort((a, b) =>
      a.empresa.razon_social.localeCompare(b.empresa.razon_social)
    );
  });
}
