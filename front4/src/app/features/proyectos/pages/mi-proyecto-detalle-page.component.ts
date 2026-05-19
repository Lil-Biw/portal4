import { Component, OnInit, OnDestroy, inject, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { ProyectosService } from '../proyectos.service';
import { CentrosService } from '../../centros/centros.service';
import { SolicitudesService } from '../../solicitudes/solicitudes.service';
import { DocumentosService } from '../../documentos/documentos.service';
import { StatChipComponent, ChipVariant } from '../../../shared/components/stat-chip/stat-chip.component';
import { asId } from '../../../shared/utils';

@Component({
  selector: 'app-mi-proyecto-detalle-page',
  standalone: true,
  imports: [StatChipComponent],
  templateUrl: './mi-proyecto-detalle-page.component.html',
  styles: [`
    .cards-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem; }
    @media (max-width: 720px) { .cards-grid { grid-template-columns:1fr; } }
    .section-title { margin:0 0 .75rem; font-size:.95rem; font-weight:700; color:#1f2937; }
    .dl-row { display:flex; gap:.5rem; margin-bottom:.45rem; }
    .dl-label { font-size:.78rem; color:#6b7280; min-width:90px; flex-shrink:0; }
    .dl-value { font-size:.82rem; color:#1f2937; font-weight:500; }
    .doc-row { display:flex; align-items:center; justify-content:space-between; padding:.55rem .75rem; border-radius:8px; border:1px solid rgba(34,33,33,.08); margin-bottom:.4rem; font-size:.82rem; }
    .sol-row  { display:flex; align-items:center; justify-content:space-between; padding:.55rem .75rem; border-radius:8px; border:1px solid rgba(34,33,33,.08); margin-bottom:.4rem; font-size:.82rem; }
  `],
})
export class MiProyectoDetallePageComponent implements OnInit, OnDestroy {
  private readonly route              = inject(ActivatedRoute);
  private readonly router             = inject(Router);
  private readonly consumidorContext  = inject(ConsumidorContextService);
  private readonly proyectosService   = inject(ProyectosService);
  private readonly centrosService     = inject(CentrosService);
  private readonly solicitudesService = inject(SolicitudesService);
  protected readonly documentosService  = inject(DocumentosService);

  protected proyecto = computed(() =>
    this.consumidorContext.proyectoSeleccionado() ?? this.proyectosService.seleccionado()
  );

  protected empresa = computed(() => this.consumidorContext.empresaSeleccionada());

  protected centro = computed(() => {
    const p = this.proyecto();
    if (!p) return null;
    return this.centrosService.centros().find(c => asId(c._id) === asId(p.centro_costo_id)) ?? null;
  });

  protected scoreDoc = computed(() => {
    const p = this.proyecto();
    const sols = this.solicitudesService.solicitudes().filter(s =>
      p ? s.proyecto_id === asId(p._id) : false
    );
    if (sols.length === 0) return { pct: 0, aprobados: 0, revision: 0, vencido: 0, rechazado: 0, total: 0 };
    const aprobados = sols.filter(s => s.estado === 'aprobado').length;
    const revision  = sols.filter(s => s.estado === 'revision').length;
    const vencido   = sols.filter(s => s.estado === 'vencido').length;
    const rechazado = sols.filter(s => s.estado === 'rechazado').length;
    return {
      pct: Math.round((aprobados / sols.length) * 100),
      aprobados, revision, vencido, rechazado, total: sols.length,
    };
  });

  protected scoreChipVariant = computed((): ChipVariant => {
    const pct = this.scoreDoc().pct;
    if (pct >= 80) return 'ok';
    if (pct >= 50) return 'warning';
    return 'danger';
  });

  protected scoreChipLabel = computed((): string => {
    const pct = this.scoreDoc().pct;
    if (pct >= 80) return 'Bueno';
    if (pct >= 50) return 'Regular';
    return 'Bajo';
  });

  protected solicitudesProyecto = computed(() => {
    const p = this.proyecto();
    if (!p) return [];
    return this.solicitudesService.solicitudes().filter(s => s.proyecto_id === asId(p._id));
  });

  protected readonly mantenciones = [
    { titulo: 'Revisión de avance mensual',   fecha: '15 jun 2026', estado: 'Pendiente'  },
    { titulo: 'Auditoría documental interna', fecha: '2 jul 2026',  estado: 'Pendiente'  },
    { titulo: 'Entrega parcial Fase 1',       fecha: '28 may 2026', estado: 'Completada' },
    { titulo: 'Reunión de cierre de etapa',   fecha: '10 ago 2026', estado: 'Pendiente'  },
  ];

  protected estadoBadgeStyle(estado: string): string {
    if (estado === 'activo')   return 'background:rgba(0,149,214,.1);color:#0095d6';
    if (estado === 'cerrado')  return 'background:rgba(239,68,68,.1);color:#ef4444';
    return 'background:rgba(34,33,33,.07);color:#6b7280';
  }

  protected estadoSolStyle(estado: string): string {
    if (estado === 'aprobado')  return 'background:rgba(34,197,94,.1);color:#16a34a';
    if (estado === 'revision')  return 'background:rgba(245,158,11,.1);color:#d97706';
    if (estado === 'vencido')   return 'background:rgba(239,68,68,.1);color:#ef4444';
    if (estado === 'rechazado') return 'background:rgba(239,68,68,.1);color:#ef4444';
    return 'background:rgba(34,33,33,.07);color:#6b7280';
  }

  protected formatFecha(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  protected descargarDoc(url: string): void {
    this.documentosService.descargar(url);
  }

  volver(): void {
    this.consumidorContext.seleccionarProyecto(null);
    this.router.navigate(['/mis-proyectos']);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.centrosService.cargar();
    if (!this.consumidorContext.proyectoSeleccionado()) {
      this.proyectosService.cargarUno(id);
    }
    const emp = this.empresa();
    if (emp) {
      this.solicitudesService.cargar(emp._id, undefined, id);
      const p = this.proyecto();
      const c = this.centro();
      if (p) {
        this.documentosService.cargar('proyecto', emp.razon_social, c?.nombre, p.nombre);
      }
    }
  }

  ngOnDestroy(): void {
    this.consumidorContext.seleccionarProyecto(null);
  }
}
