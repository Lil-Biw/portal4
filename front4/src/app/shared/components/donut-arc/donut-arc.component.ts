import { Component, Input } from '@angular/core';
import { porcentajeColorFn } from '../../utils';

@Component({
  selector: 'app-donut-arc',
  standalone: true,
  template: `
    <svg [attr.width]="size" [attr.height]="size"
         [attr.viewBox]="'0 0 '+size+' '+size"
         style="display:block;flex-shrink:0">
      <!-- Track -->
      <circle
        [attr.cx]="half" [attr.cy]="half" [attr.r]="r"
        fill="none" stroke="#e5e7eb" [attr.stroke-width]="sw"/>
      @if (value > 0) {
        <!-- Arc desde arriba (-90°) -->
        <circle
          [attr.cx]="half" [attr.cy]="half" [attr.r]="r"
          fill="none"
          [attr.stroke]="arcColor"
          [attr.stroke-width]="sw"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="dashOffset"
          [attr.transform]="'rotate(-90 '+half+' '+half+')'"/>
      } @else {
        <!-- Punto rojo en la cima para 0% -->
        <circle [attr.cx]="half" [attr.cy]="half - r" r="4" fill="#dc2626"/>
      }
      <!-- Texto central -->
      <text
        [attr.x]="half" [attr.y]="half + 1"
        text-anchor="middle"
        dominant-baseline="middle"
        [attr.font-size]="fontSize"
        font-weight="700"
        font-family="inherit"
        [attr.fill]="value > 0 ? arcColor : '#9ca3af'">{{ value }}%</text>
    </svg>
  `,
})
export class DonutArcComponent {
  @Input() value = 0;
  @Input() size  = 64;

  get half()          { return this.size / 2; }
  get sw()            { return Math.max(6, Math.round(this.size * 0.12)); }
  get r()             { return (this.size - this.sw) / 2; }
  get circumference() { return 2 * Math.PI * this.r; }
  get dashOffset()    { return this.circumference * (1 - this.value / 100); }
  get fontSize()      { return Math.round(this.size * 0.22); }

  get arcColor(): string {
    return porcentajeColorFn(this.value);
  }
}
