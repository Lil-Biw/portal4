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
    .toolbar { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid var(--border-subtle); }
    .title { margin:0; font-size:1.5rem; font-weight:700; color:var(--fg-1); }
    .actions { display:flex; gap:.5rem; flex-wrap:wrap; }
    .btn { padding:.55rem 1rem; border-radius:8px; border:1px solid var(--border-default); background:transparent; cursor:pointer; font-weight:600; font-size:.875rem; color:var(--fg-2); transition:all .15s ease; }
    .btn:hover { border-color:var(--border-strong); background:var(--bg-1); }
    .btn.active { background:var(--sc-cyan); color:var(--fg-inverse); border-color:var(--sc-cyan); }
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
