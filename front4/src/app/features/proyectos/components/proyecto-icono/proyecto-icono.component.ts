import { Component, Input } from '@angular/core';
import { clavePorColorProyecto } from '../../proyectos-icons';

@Component({
  selector: 'app-proyecto-icono',
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
          @case ('carpeta') {
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
          }
          @case ('objetivo') {
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          }
          @case ('cohete') {
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
          }
          @case ('bandera') {
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" x2="4" y1="22" y2="15"/>
          }
          @case ('maletin') {
            <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          }
          @default {
            <line x1="12" x2="12" y1="20" y2="10"/>
            <line x1="18" x2="18" y1="20" y2="4"/>
            <line x1="6" x2="6" y1="20" y2="16"/>
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
export class ProyectoIconoComponent {
  @Input() color = '#0095d6';
  @Input() size  = 20;

  protected get clave(): string {
    return clavePorColorProyecto(this.color);
  }
}
