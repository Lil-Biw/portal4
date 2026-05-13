import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { CentrosService } from '../centros.service';

@Component({
  selector: 'app-mis-centros-page',
  standalone: true,
  imports: [NgFor, NgIf],
  template: `
    <h2 style="margin:0 0 1.5rem;font-size:1.5rem;font-weight:700;color:#1f2937">Centros de costos</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem">
      <div class="card" *ngFor="let c of service.centros()">
        <h3 style="margin:0 0 .5rem;font-size:1rem;font-weight:700;color:#1f2937">{{ c.nombre }}</h3>
        <p style="margin:0 0 .25rem;font-size:.85rem;color:#6b7280">Cód. {{ c.codigo }}</p>
        <p *ngIf="c.ubicacion_ciudad" style="margin:0;font-size:.82rem;color:#9ca3af">{{ c.ubicacion_ciudad }}</p>
      </div>
      <p *ngIf="service.centros().length === 0" class="empty">Sin centros asignados.</p>
    </div>
  `,
})
export class MisCentrosPageComponent implements OnInit {
  protected readonly service = inject(CentrosService);
  ngOnInit(): void { this.service.cargar(); }
}
