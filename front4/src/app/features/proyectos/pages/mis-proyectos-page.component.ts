import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ProyectosService } from '../proyectos.service';

@Component({
  selector: 'app-mis-proyectos-page',
  standalone: true,
  imports: [NgFor, NgIf],
  template: `
    <h2 style="margin:0 0 1.5rem;font-size:1.5rem;font-weight:700;color:#1f2937">Proyectos</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem">
      <div class="card" *ngFor="let p of service.proyectos()">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;margin-bottom:.5rem">
          <h3 style="margin:0;font-size:1rem;font-weight:700;color:#1f2937">{{ p.nombre }}</h3>
          <span style="font-size:.72rem;font-weight:700;padding:.2rem .55rem;border-radius:999px;background:rgba(0,149,214,.1);color:#0095d6;white-space:nowrap">{{ p.estado }}</span>
        </div>
        <p style="margin:0 0 .25rem;font-size:.85rem;color:#6b7280">Cód. {{ p.codigo }}</p>
        <p *ngIf="p.descripcion" style="margin:0;font-size:.82rem;color:#9ca3af">{{ p.descripcion }}</p>
      </div>
      <p *ngIf="service.proyectos().length === 0" class="empty">Sin proyectos asignados.</p>
    </div>
  `,
})
export class MisProyectosPageComponent implements OnInit {
  protected readonly service = inject(ProyectosService);
  ngOnInit(): void { this.service.cargar(); }
}
