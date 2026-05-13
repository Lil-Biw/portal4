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
      border-radius: 8px;
      background: rgba(34,197,98,.08);
      color: #16a34a;
      border: 1px solid rgba(34,197,98,.2);
      font-size: .875rem;
    }
    .banner.error {
      background: rgba(239,68,68,.08);
      color: #ef4444;
      border-color: rgba(239,68,68,.2);
    }
  `],
})
export class StatusBannerComponent {
  @Input() status: Status | null = null;
}
