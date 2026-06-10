import { Component, Input, OnChanges } from '@angular/core';

interface Point { x: number; y: number; }

@Component({
  selector: 'app-spider-chart',
  standalone: true,
  imports: [],
  template: `
    <div style="display:inline-block">
      <svg [attr.viewBox]="'0 0 ' + size + ' ' + size" [attr.width]="size" [attr.height]="size" style="display:block;margin:auto;overflow:visible">
        <!-- Grid circles -->
        @for (level of gridLevels; track $index) {
          <g>
            <polygon
              [attr.points]="polygonPoints(level)"
              fill="none"
              stroke="rgba(34,33,33,.1)"
              stroke-width="1" />
          </g>
        }

        <!-- Axes -->
        @for (ax of axes; track $index) {
          <g>
            <line
              [attr.x1]="cx" [attr.y1]="cy"
              [attr.x2]="ax.tip.x" [attr.y2]="ax.tip.y"
              stroke="rgba(34,33,33,.12)"
              stroke-width="1" />
          </g>
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
          <g>
            <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="4" fill="#0095d6" />
          </g>
        }

        <!-- Promedio polygon -->
        @if (dataPromPoints) {
          <polygon
            [attr.points]="dataPromPoints"
            fill="rgba(34,197,94,.15)"
            stroke="#22c55e"
            stroke-width="2"
            stroke-dasharray="4,3"
            stroke-linejoin="round" />

          <!-- Promedio dots -->
          @for (pt of dataPromCoords; track $index) {
            <g>
              <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.5" fill="#22c55e" />
            </g>
          }
        }

        <!-- Labels -->
        @for (ax of axes; track $index; let i = $index) {
          <g>
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
            <!-- Percentage -->
            <text
              [attr.x]="labelPos(ax.tip, i).x"
              [attr.y]="labelPos(ax.tip, i).y + 12"
              [attr.text-anchor]="textAnchor(i)"
              dominant-baseline="middle"
              font-size="9"
              font-family="inherit"
              fill="#0095d6"
              font-weight="700">
              {{ values[i] }}%
            </text>
          </g>
        }
      </svg>

      @if (valuesPromedio?.length) {
        <div style="display:flex;gap:14px;justify-content:center;margin-top:8px">
          <div style="display:flex;align-items:center;gap:5px">
            <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="#0095d6" stroke-width="2"/></svg>
            <span style="font-size:9px;color:#374151;font-family:inherit">Configurado</span>
          </div>
          <div style="display:flex;align-items:center;gap:5px">
            <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="#22c55e" stroke-width="2" stroke-dasharray="4,2"/></svg>
            <span style="font-size:9px;color:#374151;font-family:inherit">Promedio centros</span>
          </div>
        </div>
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

    if (this.valuesPromedio && this.valuesPromedio.length === this.labels.length) {
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
