import { Component, Input } from '@angular/core';

export type ChipVariant = 'ok' | 'warning' | 'danger' | 'neutral';

@Component({
  selector: 'app-stat-chip',
  standalone: true,
  template: `<span class="chip" [class]="variant">{{ label }}</span>`,
  styles: [`
    .chip { padding:.2rem .55rem; border-radius:999px; font-size:.7rem; font-weight:700; display:inline-block; }
    .ok      { background:rgba(0,149,214,.12); color:#0095d6; }
    .warning { background:rgba(245,158,11,.12); color:#d97706; }
    .danger  { background:rgba(239,68,68,.12);  color:#ef4444; }
    .neutral { background:rgba(34,33,33,.07);   color:#6b7280; }
  `],
})
export class StatChipComponent {
  @Input() label = '';
  @Input() variant: ChipVariant = 'ok';
}
