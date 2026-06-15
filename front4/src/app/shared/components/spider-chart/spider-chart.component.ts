import { Component, Input, OnChanges } from '@angular/core';

interface Point { x: number; y: number; }

@Component({
  selector: 'app-spider-chart',
  standalone: true,
  imports: [],
  template: `
    <div style="display:inline-block">
      @if (isDefault) {
        <div style="width:{{size}}px;height:{{size}}px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px dashed #e5e7eb;border-radius:12px;gap:.5rem">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          <span style="font-size:.78rem;font-weight:600;color:#9ca3af;text-align:center;padding:0 1rem">Evaluación aún<br>no realizada</span>
        </div>
      } @else {
        <svg [attr.viewBox]="'0 0 ' + size + ' ' + size" [attr.width]="size" [attr.height]="size" style="display:block;margin:auto;overflow:visible">
          <!-- Grid -->
          @for (level of gridLevels; track $index) {
            <polygon
              [attr.points]="polygonPoints(level)"
              fill="none"
              stroke="rgba(34,33,33,.1)"
              stroke-width="1" />
          }

          <!-- Axes -->
          @for (ax of axes; track $index) {
            <line
              [attr.x1]="cx" [attr.y1]="cy"
              [attr.x2]="ax.tip.x" [attr.y2]="ax.tip.y"
              stroke="rgba(34,33,33,.12)"
              stroke-width="1" />
          }

          <!-- Data polygon -->
          <polygon
            [attr.points]="dataPoints"
            fill="rgba(0,149,214,.18)"
            stroke="#0095d6"
            stroke-width="2"
            stroke-linejoin="round" />

          <!-- Data dots -->
          @for (pt of dataCoords; track $index) {
            <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="4" fill="#0095d6" />
          }

          <!-- Promedio polygon (solo si no está en estado pendiente) -->
          @if (dataPromPoints) {
            <polygon
              [attr.points]="dataPromPoints"
              fill="rgba(34,197,94,.15)"
              stroke="#22c55e"
              stroke-width="2"
              stroke-dasharray="4,3"
              stroke-linejoin="round" />

            @for (pt of dataPromCoords; track $index) {
              <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.5" fill="#22c55e" />
            }
          }

          <!-- Labels: muestra escala 1–10 -->
          @for (ax of axes; track $index; let i = $index) {
            <text
              [attr.x]="labelPos(ax.tip, i).x"
              [attr.y]="labelPos(ax.tip, i).y"
              [attr.text-anchor]="textAnchor(i)"
              dominant-baseline="middle"
              font-size="10"
              font-family="inherit"
              fill="#374151"
              font-weight="500">
              {{ ax.label }}
            </text>
            <text
              [attr.x]="labelPos(ax.tip, i).x"
              [attr.y]="labelPos(ax.tip, i).y + 12"
              [attr.text-anchor]="textAnchor(i)"
              dominant-baseline="middle"
              font-size="9"
              font-family="inherit"
              fill="#0095d6"
              font-weight="700">
              {{ scaleDisplay(values[i]) }}
            </text>
          }
        </svg>

        @if (valuesPromedio?.length) {
          <div style="display:flex;gap:14px;justify-content:center;margin-top:8px">
            <div style="display:flex;align-items:center;gap:5px">
              <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#0095d6" stroke-width="2"/></svg>
              <span style="font-size:9px;color:#374151;font-family:inherit">Configurado</span>
            </div>
            @if (isPromedioDefault) {
              <div style="display:flex;align-items:center;gap:5px">
                <span style="font-size:9px;color:#9ca3af;font-family:inherit;font-style:italic">Promedio centros: pendiente</span>
              </div>
            } @else {
              <div style="display:flex;align-items:center;gap:5px">
                <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#22c55e" stroke-width="2" stroke-dasharray="4,2"/></svg>
                <span style="font-size:9px;color:#374151;font-family:inherit">Promedio centros</span>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class SpiderChartComponent implements OnChanges {
  @Input() labels: string[] = [];
  @Input() values: number[] = [];
  @Input() valuesPromedio?: number[];
  @Input() size = 260;

  readonly cx = 130;
  readonly cy = 130;
  readonly radius = 72;
  readonly gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  axes: { label: string; tip: Point; angle: number }[] = [];
  dataCoords: Point[] = [];
  dataPoints = '';
  dataPromCoords: Point[] = [];
  dataPromPoints = '';

  get isDefault(): boolean {
    return this.values.length > 0 && this.values.every(v => v === 50);
  }

  get isPromedioDefault(): boolean {
    return !!(this.valuesPromedio?.length && this.valuesPromedio.every(v => v === 50));
  }

  scaleDisplay(v: number): number {
    return Math.round(v / 10);
  }

  ngOnChanges(): void {
    const n = this.labels.length;
    this.axes = this.labels.map((label, i) => {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
      return {
        label,
        angle,
        tip: {
          x: this.cx + this.radius * Math.cos(angle),
          y: this.cy + this.radius * Math.sin(angle),
        },
      };
    });

    this.dataCoords = this.axes.map((ax, i) => {
      const r = (this.values[i] ?? 0) / 100;
      return {
        x: this.cx + this.radius * r * Math.cos(ax.angle),
        y: this.cy + this.radius * r * Math.sin(ax.angle),
      };
    });

    this.dataPoints = this.dataCoords.map(p => `${p.x},${p.y}`).join(' ');

    if (this.valuesPromedio && this.valuesPromedio.length === this.labels.length && !this.isPromedioDefault) {
      this.dataPromCoords = this.axes.map((ax, i) => {
        const r = (this.valuesPromedio![i] ?? 0) / 100;
        return {
          x: this.cx + this.radius * r * Math.cos(ax.angle),
          y: this.cy + this.radius * r * Math.sin(ax.angle),
        };
      });
      this.dataPromPoints = this.dataPromCoords.map(p => `${p.x},${p.y}`).join(' ');
    } else {
      this.dataPromCoords = [];
      this.dataPromPoints = '';
    }
  }

  polygonPoints(fraction: number): string {
    return this.axes.map(ax => {
      const x = this.cx + this.radius * fraction * Math.cos(ax.angle);
      const y = this.cy + this.radius * fraction * Math.sin(ax.angle);
      return `${x},${y}`;
    }).join(' ');
  }

  labelPos(tip: Point, i: number): Point {
    const margin = 22;
    const dx = tip.x - this.cx;
    const dy = tip.y - this.cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      x: tip.x + (dx / len) * margin,
      y: tip.y + (dy / len) * margin,
    };
  }

  textAnchor(i: number): string {
    const ax = this.axes[i];
    if (!ax) return 'middle';
    const dx = ax.tip.x - this.cx;
    if (dx > 5)  return 'start';
    if (dx < -5) return 'end';
    return 'middle';
  }
}
