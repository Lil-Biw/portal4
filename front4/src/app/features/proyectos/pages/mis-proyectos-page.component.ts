import { Component, inject, computed, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { ProyectosService } from '../proyectos.service';
import { CentrosService } from '../../centros/centros.service';
import { SolicitudesService } from '../../solicitudes/solicitudes.service';
import { DocumentosService } from '../../documentos/documentos.service';
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
  private  readonly documentosService   = inject(DocumentosService);

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
      for (const rawId of p.centro_costo_ids ?? []) {
        const cId = asId(rawId);
        if (!grupos.has(cId)) {
          const c = centros.find(c => asId(c._id) === cId);
          grupos.set(cId, { nombre: c?.nombre ?? '—', proyectos: [] });
        }
        grupos.get(cId)!.proyectos.push(p);
      }
    }
    return Array.from(grupos.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  private static readonly ESTADO_BADGE_STYLE: Record<string, string> = {
    borrador:      'background:rgba(107,114,128,.12);color:#6b7280',
    planificacion: 'background:rgba(100,116,139,.12);color:#64748b',
    activo:        'background:rgba(22,163,74,.12);color:#16a34a',
    en_pausa:      'background:rgba(217,119,6,.12);color:#d97706',
    en_revision:   'background:rgba(124,58,237,.12);color:#7c3aed',
    cerrado:       'background:rgba(156,163,175,.12);color:#9ca3af',
    cancelado:     'background:rgba(220,38,38,.12);color:#dc2626',
  };

  protected estadoBadgeStyle(estado: string): string {
    return MisProyectosPageComponent.ESTADO_BADGE_STYLE[estado]
      ?? 'background:rgba(34,33,33,.07);color:#6b7280';
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

    effect(() => {
      const emp      = this.consumidorContext.empresaSeleccionada();
      const centros  = this.centrosService.centros()
        .filter(c => asId(c.cliente_id) === asId(emp?._id ?? ''));
      const proyectos = this.proyectos();
      if (!emp) return;
      this.documentosService.cargarTodosProyectos(emp._id, proyectos, centros);
    });
  }


  scoreDeProyecto(proyectoId: string) {
    const sols = this.solicitudesService.solicitudes()
      .filter(s => asId(s.proyecto_id) === proyectoId);
    const grupo = this.documentosService.documentosPorProyecto()
      .find(g => g.proyectoId === proyectoId);
    const docsActivos = grupo?.docs.length ?? 0;
    return calcularScoreDocumental(sols, docsActivos, 0);
  }

  verDetalle(proyecto: Proyecto): void {
    this.consumidorContext.seleccionarProyecto(proyecto);
    this.router.navigate(['/mis-proyectos', proyecto._id]);
  }
}
