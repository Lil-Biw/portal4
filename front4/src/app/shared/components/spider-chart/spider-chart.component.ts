import { Component, Input, OnChanges } from '@angular/core';
import { NgFor } from '@angular/common';

interface Point { x: number; y: number; }

@Component({
  selector: 'app-spider-chart',
  standalone: true,
  imports: [NgFor],
  template: `
    <svg [attr.viewBox]="'0 0 ' + size + ' ' + size" [attr.width]="size" [attr.height]="size" style="display:block;margin:auto;overflow:visible">
      <!-- Grid circles -->
      <g *ngFor="let level of gridLevels">
        <polygon
          [attr.points]="polygonPoints(level)"
          fill="none"
          stroke="rgba(34,33,33,.1)"
          stroke-width="1" />
      </g>

      <!-- Axes -->
      <g *ngFor="let ax of axes">
        <line
          [attr.x1]="cx" [attr.y1]="cy"
          [attr.x2]="ax.tip.x" [attr.y2]="ax.tip.y"
          stroke="rgba(34,33,33,.12)"
          stroke-width="1" />
      </g>

      <!-- Data polygon -->
      <polygon
        [attr.points]="dataPoints"
        fill="rgba(0,149,214,.18)"
        stroke="#0095d6"
        stroke-width="2"
        stroke-linejoin="round" />

      <!-- Data dots -->
      <g *ngFor="let pt of dataCoords">
        <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="4" fill="#0095d6" />
      </g>

      <!-- Labels -->
      <g *ngFor="let ax of axes; let i = index">
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
    </svg>
  `,
})
export class SpiderChartComponent implements OnChanges {
  @Input() labels: string[] = [];
  @Input() values: number[] = [];
  @Input() size = 260;

  readonly cx = 130;
  readonly cy = 130;
  readonly radius = 72;
  readonly gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  axes: { label: string; tip: Point; angle: number }[] = [];
  dataCoords: Point[] = [];
  dataPoints = '';

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
