import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';
import { Status } from '../../models/status.model';

@Component({
  selector: 'app-status-banner',
  standalone: true,
  imports: [NgIf],
  template: `
    <div *ngIf="status" class="banner" [class.error]="status.type === 'error'">
      {{ status.text }}
    </div>
  `,
  styles: [`
    .banner {
      padding: .75rem 1rem;
      border-radius: var(--radius-sm);
      background: var(--ok-bg);
      color: var(--ok);
      border: 1px solid var(--ok);
      font-size: .875rem;
    }
    .banner.error {
      background: var(--danger-bg);
      color: var(--danger);
      border-color: var(--danger);
    }
  `],
})
export class StatusBannerComponent {
  @Input() status: Status | null = null;
}
