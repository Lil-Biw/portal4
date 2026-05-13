import { Component, EventEmitter, Input, Output } from '@angular/core';

export type CrudAction = 'crear' | 'editar' | 'eliminar' | 'buscar';

@Component({
  selector: 'app-crud-toolbar',
  standalone: true,
  template: `
    <div class="toolbar">
      <h2 class="title">{{ entity }}</h2>
      <div class="actions">
        @for (a of actions; track a) {
          <button
            class="btn"
            [class.active]="action === a"
            (click)="actionChange.emit(a)">
            {{ labels[a] }}
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .toolbar { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid rgba(34,33,33,.1); }
    .title { margin:0; font-size:1.5rem; font-weight:700; color:#1f2937; }
    .actions { display:flex; gap:.5rem; flex-wrap:wrap; }
    .btn { padding:.55rem 1rem; border-radius:8px; border:1px solid rgba(34,33,33,.2); background:transparent; cursor:pointer; font-weight:600; font-size:.875rem; color:#374151; transition:all .15s ease; }
    .btn:hover { border-color:rgba(34,33,33,.4); background:rgba(255,255,255,.5); }
    .btn.active { background:var(--accent,#0095d6); color:#fff; border-color:var(--accent,#0095d6); }
  `],
})
export class CrudToolbarComponent {
  @Input() entity = '';
  @Input() action: CrudAction = 'crear';
  @Input() actions: CrudAction[] = ['crear', 'editar', 'eliminar', 'buscar'];
  @Output() actionChange = new EventEmitter<CrudAction>();

  readonly labels: Record<CrudAction, string> = {
    crear: 'Crear',
    editar: 'Editar',
    eliminar: 'Eliminar',
    buscar: 'Buscar',
  };
}
