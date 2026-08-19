import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Cliente } from '../../../../shared/models/cliente.model';
import { asId } from '../../../../shared/utils';

@Component({
  selector: 'app-clientes-list',
  standalone: true,
  imports: [],
  templateUrl: './clientes-list.component.html',
  styles: [`
    .empresa-list { display: flex; flex-direction: column; gap: .75rem; }
    .empresa-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: var(--bg-0);
      border-radius: 12px;
      border: 1px solid var(--border-subtle);
      padding: .85rem 1.1rem;
      box-shadow: var(--shadow-1);
    }
    .avatar {
      width: 46px; height: 46px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: .95rem; color: var(--fg-inverse);
      flex-shrink: 0;
    }
    .empresa-info { flex: 1; min-width: 0; }
    .empresa-nombre { font-weight: 700; font-size: .95rem; color: var(--fg-1); margin: 0 0 .2rem; }
    .empresa-meta { font-size: .8rem; color: var(--fg-4); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .score-block { text-align: center; flex-shrink: 0; min-width: 60px; }
    .score-label { font-size: .65rem; font-weight: 700; letter-spacing: .08em; color: var(--fg-5); text-transform: uppercase; display: block; }
    .score-num { font-size: 1.5rem; font-weight: 800; line-height: 1.1; }
    .score-empty { font-size: .75rem; color: #d1d5db; font-weight: 600; }
    .card-actions { display: flex; align-items: center; gap: .4rem; flex-shrink: 0; }
    .btn-ficha {
      display: flex; align-items: center; gap: .3rem;
      padding: .38rem .75rem;
      border-radius: 8px;
      border: 1px solid rgba(0,0,0,.15);
      background: transparent;
      color: var(--fg-2);
      font-size: .8rem; font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all .15s;
      white-space: nowrap;
    }
    .btn-ficha:hover { border-color: var(--sc-cyan); color: var(--sc-cyan); background: var(--sc-cyan-tint-6); }
    .btn-icon {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px;
      border-radius: 8px;
      border: 1px solid rgba(0,0,0,.12);
      background: transparent;
      cursor: pointer;
      transition: all .15s;
      color: var(--fg-4);
      padding: 0;
    }
    .btn-icon:hover { border-color: var(--fg-2); color: var(--fg-2); background: rgba(0,0,0,.04); }
    .btn-icon.danger { color: var(--danger); border-color: var(--danger-bg); }
    .btn-icon.danger:hover { background: var(--danger-bg); border-color: var(--danger); }
    .empty-msg { color: var(--fg-5); font-size: .9rem; text-align: center; padding: 2rem 0; }
  `],
})
export class ClientesListComponent {
  @Input() clientes: Cliente[] = [];
  @Input() seleccionadoId: string | null = null;
  @Input() mostrarVerFicha = true;
  @Input() scoresPorEmpresa: Map<string, number> = new Map();
  @Input() puedeEditar = true;
  @Input() puedeEliminar = true;
  @Output() editado      = new EventEmitter<Cliente>();
  @Output() eliminado    = new EventEmitter<string>();
  @Output() verFicha     = new EventEmitter<Cliente>();
  @Output() editarScore  = new EventEmitter<Cliente>();

  private readonly AVATAR_COLORS = [
    '#4f46e5', '#0891b2', '#059669', '#d97706',
    '#dc2626', '#7c3aed', '#db2777', '#0ea5e9',
  ];

  getInitials(name: string): string {
    return name.split(/\s+/).filter(w => w.length > 0)
      .slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  getAvatarBg(name: string): string {
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
    return this.AVATAR_COLORS[hash % this.AVATAR_COLORS.length];
  }

  getScore(cliente: Cliente): number | null {
    const s = this.scoresPorEmpresa.get(asId(cliente._id));
    return s !== undefined ? s : null;
  }

  getScoreColor(score: number): string {
    if (score >= 75) return '#2EAE6E';
    if (score >= 50) return '#00AEEF';
    return '#F5A524';
  }
}
