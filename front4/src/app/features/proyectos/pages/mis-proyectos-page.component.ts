import { Component, inject, computed, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { ProyectosService } from '../proyectos.service';
import { CentrosService } from '../../centros/centros.service';
import { SolicitudesService } from '../../solicitudes/solicitudes.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { DonutArcComponent } from '../../../shared/components/donut-arc/donut-arc.component';
import { Proyecto } from '../../../shared/models/proyecto.model';
import { asId, calcularScoreDocumental } from '../../../shared/utils';

@Component({
  selector: 'app-mis-proyectos-page',
  standalone: true,
  imports: [DonutArcComponent],
  templateUrl: './mis-proyectos-page.component.html',
  styles: [`
    .proyecto-card {
      cursor: pointer;
      transition: box-shadow .15s, border-color .15s;
      border: 1px solid rgba(34,33,33,.12);
    }
    .proyecto-card:hover {
      box-shadow: 0 4px 16px rgba(0,149,214,.18);
      border-color: rgba(0,149,214,.35);
    }
  `],
})
export class MisProyectosPageComponent {
  private  readonly consumidorContext   = inject(ConsumidorContextService);
  private  readonly router              = inject(Router);
  protected readonly proyectosService   = inject(ProyectosService);
  protected readonly centrosService     = inject(CentrosService);
  protected readonly solicitudesService = inject(SolicitudesService);

  protected mostrarBuscar = signal(false);
  protected busqueda      = signal('');

  get empresa() { return this.consumidorContext.empresaSeleccionada(); }

  protected proyectos = computed(() => {
    const emp = this.consumidorContext.empresaSeleccionada();
    if (!emp) return [];
    return this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === asId(emp._id));
  });

  protected proyectosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.proyectos();
    return this.proyectos().filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      p.codigo.toLowerCase().includes(q) ||
      (p.descripcion ?? '').toLowerCase().includes(q)
    );
  });

  protected centrosConProyectos = computed(() => {
    const ps = this.proyectosFiltrados();
    const centros = this.centrosService.centros();
    const grupos = new Map<string, { nombre: string; proyectos: Proyecto[] }>();
    for (const p of ps) {
      const cId = asId(p.centro_costo_id);
      if (!grupos.has(cId)) {
        const c = centros.find(c => asId(c._id) === cId);
        grupos.set(cId, { nombre: c?.nombre ?? '—', proyectos: [] });
      }
      grupos.get(cId)!.proyectos.push(p);
    }
    return Array.from(grupos.values());
  });

  protected estadoBadgeStyle(estado: string): string {
    if (estado === 'activo')   return 'background:rgba(0,149,214,.1);color:#0095d6';
    if (estado === 'cerrado')  return 'background:rgba(239,68,68,.1);color:#ef4444';
    return 'background:rgba(34,33,33,.07);color:#6b7280';
  }

  toggleBuscar(): void {
    this.mostrarBuscar.update(v => !v);
    if (!this.mostrarBuscar()) this.busqueda.set('');
  }

  constructor() {
    effect(() => {
      const emp = this.consumidorContext.empresaSeleccionada();
      if (emp) {
        this.proyectosService.cargarPorEmpresa(emp._id);
        this.solicitudesService.cargar(emp._id);
      }
    });
  }


  scoreDeProyecto(proyectoId: string) {
    const sols = this.solicitudesService.solicitudes()
      .filter(s => s.proyecto_id === proyectoId);
    return calcularScoreDocumental(sols);
  }

  verDetalle(proyecto: Proyecto): void {
    this.consumidorContext.seleccionarProyecto(proyecto);
    this.router.navigate(['/mis-proyectos', proyecto._id]);
  }
}
