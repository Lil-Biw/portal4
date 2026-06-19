import { Component, Input } from '@angular/core';
import { clavePorColorActividad } from '../../actividades-icons';

@Component({
  selector: 'app-actividad-icono',
  standalone: true,
  template: `
    <div class="icono-wrap"
         [style.width.px]="size + 20"
         [style.height.px]="size + 20"
         [style.background]="color + '26'"
         [style.border-radius.px]="10">
      <svg [attr.width]="size" [attr.height]="size"
           viewBox="0 0 24 24" fill="none"
           [attr.stroke]="color"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        @switch (clave) {
          @case ('calendario') {
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          }
          @case ('check') {
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          }
          @case ('llave') {
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          }
          @case ('alerta') {
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          }
          @case ('reunion') {
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          }
          @default {
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          }
        }
      </svg>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .icono-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
  `],
})
export class ActividadIconoComponent {
  @Input() color = '#0095d6';
  @Input() size  = 20;

  protected get clave(): string {
    return clavePorColorActividad(this.color);
  }
}
