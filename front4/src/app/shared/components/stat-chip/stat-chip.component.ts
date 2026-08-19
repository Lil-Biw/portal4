import { Component, Input } from '@angular/core';

export type ChipVariant = 'ok' | 'warning' | 'danger' | 'neutral';

@Component({
  selector: 'app-stat-chip',
  standalone: true,
  template: `<span class="chip" [class]="variant">{{ label }}</span>`,
  styles: [`
    .chip { padding:.2rem .55rem; border-radius:var(--radius-pill); font-size:.7rem; font-weight:700; display:inline-block; }
    .ok      { background:var(--ok-bg);      color:var(--ok); }
    .warning { background:var(--warn-bg);    color:var(--warn); }
    .danger  { background:var(--danger-bg);  color:var(--danger); }
    .neutral { background:var(--bg-2);       color:var(--fg-3); }
  `],
})
export class StatChipComponent {
  @Input() label = '';
  @Input() variant: ChipVariant = 'ok';
}
