import { Component, OnInit, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { SolicitudesService } from '../../solicitudes/solicitudes.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { MantencionesService } from '../../mantenciones/mantenciones.service';
import { StatChipComponent, ChipVariant } from '../../../shared/components/stat-chip/stat-chip.component';
import { SpiderChartComponent } from '../../../shared/components/spider-chart/spider-chart.component';
import { CentroCosto } from '../../../shared/models/centro.model';
import { Proyecto } from '../../../shared/models/proyecto.model';
import { asId } from '../../../shared/utils';

@Component({
  selector: 'app-mi-ficha-page',
  standalone: true,
  imports: [StatChipComponent, SpiderChartComponent],
  templateUrl: './mi-ficha-page.component.html',
})
export class MiFichaPageComponent implements OnInit {
  private readonly consumidorContext   = inject(ConsumidorContextService);
  private readonly solicitudesService  = inject(SolicitudesService);
  private readonly centrosService      = inject(CentrosService);
  private readonly proyectosService    = inject(ProyectosService);
  private readonly mantencionesService = inject(MantencionesService);
  private readonly router              = inject(Router);

  protected empresa = computed(() => this.consumidorContext.empresaSeleccionada());

  protected centrosDeEmpresa = computed(() => {
    const emp = this.consumidorContext.empresaSeleccionada();
    if (!emp) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === asId(emp._id));
  });

  private centroIdsPorEmpresa = computed(() => {
    const emp = this.consumidorContext.empresaSeleccionada();
    if (!emp) return new Set<string>();
    return new Set(
      this.centrosService.centros()
        .filter(c => asId(c.cliente_id) === asId(emp._id))
        .map(c => asId(c._id))
    );
  });

  protected mantencionesDeEmpresa = computed(() => {
    const ids = this.centroIdsPorEmpresa();
    if (ids.size === 0) return [];
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    hace30.setHours(0, 0, 0, 0);
    return this.mantencionesService.mantenciones()
      .filter(m => ids.has(asId(m.centro_costo_id)) && new Date(m.fecha) >= hace30)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 3);
  });

  protected proyectosDeEmpresa = computed(() => {
    const emp = this.consumidorContext.empresaSeleccionada();
    if (!emp) return [];
    return this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === asId(emp._id));
  });

  protected scoreDocumental = computed(() => {
    const sols = this.solicitudesService.solicitudes();
    if (sols.length === 0) return { pct: 0, aprobados: 0, revision: 0, vencido: 0, rechazado: 0, pendiente: 0, total: 0 };
    const aprobados = sols.filter(s => s.estado === 'aprobado').length;
    const revision  = sols.filter(s => s.estado === 'revision').length;
    const vencido   = sols.filter(s => s.estado === 'vencido').length;
    const rechazado = sols.filter(s => s.estado === 'rechazado').length;
    const pendiente = sols.filter(s => s.estado === 'pendiente').length;
    return {
      pct: Math.round((aprobados / sols.length) * 100),
      aprobados, revision, vencido, rechazado, pendiente,
      total: sols.length,
    };
  });

  protected solicitudesEmpresa = computed(() =>
    this.solicitudesService.solicitudes()
  );

  protected docsNivelEmpresa = computed(() =>
    this.solicitudesService.solicitudes()
      .filter(s => !s.centro_costo_id && !s.proyecto_id)
  );

  protected scoreChipVariant = computed((): ChipVariant => {
    const pct = this.scoreDocumental().pct;
    if (pct >= 80) return 'ok';
    if (pct >= 50) return 'warning';
    return 'danger';
  });

  protected scoreChipLabel = computed((): string => {
    const pct = this.scoreDocumental().pct;
    if (pct >= 80) return 'Bueno';
    if (pct >= 50) return 'Regular';
    return 'Bajo';
  });

  readonly spiderLabels = [
    'RRHH y\ndocumentación',
    'Normativa',
    'Suministro',
    'Seguridad\nOperacional',
    'Continuidad\nOperacional',
  ];
  readonly spiderValues = [72, 58, 84, 67, 75];

  readonly certificados = [
    { nombre: 'Certificado ISO 9001',      vencimiento: '30 nov 2026' },
    { nombre: 'Certificado OHSAS 18001',   vencimiento: '15 ago 2026' },
  ];

  ngOnInit(): void {
    this.centrosService.cargar();
    this.proyectosService.cargar();
    this.mantencionesService.cargar();
    const emp = this.empresa();
    if (emp) this.solicitudesService.cargar(emp._id);
  }

  protected esPasada(fecha: string): boolean {
    return new Date(fecha) < new Date();
  }

  protected formatFechaShort(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Resumen de solicitudes para un centro
  resumenCentro(centroId: string): string {
    const sols = this.solicitudesService.solicitudes()
      .filter(s => s.centro_costo_id === centroId);
    if (sols.length === 0) return 'Sin solicitudes';
    const vencido  = sols.filter(s => s.estado === 'vencido').length;
    const revision = sols.filter(s => s.estado === 'revision').length;
    const base = `${sols.length} doc${sols.length !== 1 ? 's' : ''}`;
    if (vencido > 0)  return `${base} · ${vencido} vencido${vencido !== 1 ? 's' : ''}`;
    if (revision > 0) return `${base} · ${revision} en revisión`;
    return `${base} · al día`;
  }

  // Resumen de solicitudes para un proyecto
  resumenProyecto(proyectoId: string): string {
    const sols = this.solicitudesService.solicitudes()
      .filter(s => s.proyecto_id === proyectoId);
    if (sols.length === 0) return 'Sin solicitudes';
    const vencido  = sols.filter(s => s.estado === 'vencido').length;
    const revision = sols.filter(s => s.estado === 'revision').length;
    const base = `${sols.length} doc${sols.length !== 1 ? 's' : ''}`;
    if (vencido > 0)  return `${base} · ${vencido} vencido${vencido !== 1 ? 's' : ''}`;
    if (revision > 0) return `${base} · ${revision} en revisión`;
    return `${base} · al día`;
  }

  estadoStyle(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'background:#fef3c7;color:#b45309',
      revision:  'background:#dbeafe;color:#1e40af',
      aprobado:  'background:#dcfce7;color:#15803d',
      rechazado: 'background:#fee2e2;color:#dc2626',
      vencido:   'background:#f3f4f6;color:#374151',
    };
    return map[estado] ?? 'background:#f3f4f6;color:#374151';
  }

  irADocumentosEmpresa(): void {
    this.router.navigate(['/documentos'], { queryParams: { tab: 'solicitudes' } });
  }

  irACentro(centro: CentroCosto): void {
    this.consumidorContext.seleccionarCentro(centro);
    this.router.navigate(['/mis-centros']);
  }

  irAProyecto(proyecto: Proyecto): void {
    this.consumidorContext.seleccionarProyecto(proyecto);
    this.router.navigate(['/mis-proyectos', proyecto._id]);
  }
}
