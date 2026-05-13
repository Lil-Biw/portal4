import { Component } from '@angular/core';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-ayuda-page',
  standalone: true,
  imports: [NgFor],
  template: `
    <h2 style="margin:0 0 1.5rem;font-size:1.5rem;font-weight:700;color:#1f2937">Ayuda</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem">
      <div class="card" *ngFor="let i of items">
        <div style="height:80px;background:rgba(0,149,214,.06);border-radius:8px;margin-bottom:.75rem"></div>
        <div style="height:14px;width:60%;background:rgba(34,33,33,.07);border-radius:6px;margin-bottom:.5rem"></div>
        <div style="height:12px;width:80%;background:rgba(34,33,33,.05);border-radius:6px"></div>
      </div>
    </div>
  `,
})
export class AyudaPageComponent {
  readonly items = [1, 2, 3, 4];
}
