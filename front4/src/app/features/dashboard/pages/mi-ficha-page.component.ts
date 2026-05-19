import { Component, OnInit, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { SolicitudesService } from '../../solicitudes/solicitudes.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
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
  private readonly consumidorContext  = inject(ConsumidorContextService);
  private readonly solicitudesService = inject(SolicitudesService);
  private readonly centrosService     = inject(CentrosService);
  private readonly proyectosService   = inject(ProyectosService);
  private readonly router             = inject(Router);

  protected empresa = computed(() => this.consumidorContext.empresaSeleccionada());

  protected centrosDeEmpresa = computed(() => {
    const emp = this.consumidorContext.empresaSeleccionada();
    if (!emp) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === asId(emp._id));
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

  readonly mantenciones = [
    { titulo: 'Revisión tablero principal',  fecha: '7 may 2026',  estado: 'Completada' },
    { titulo: 'Auditoría eléctrica anual',   fecha: '18 jun 2026', estado: 'Pendiente'  },
    { titulo: 'Termografía instalaciones',   fecha: '2 ago 2026',  estado: 'Pendiente'  },
    { titulo: 'Inspección general HVAC',     fecha: '12 mar 2026', estado: 'Completada' },
  ];

  readonly certificados = [
    { nombre: 'Certificado ISO 9001',      vencimiento: '30 nov 2026' },
    { nombre: 'Certificado OHSAS 18001',   vencimiento: '15 ago 2026' },
    { nombre: 'Permiso de operación 2026', vencimiento: '31 dic 2026' },
    { nombre: 'Certificado eléctrico SEC', vencimiento: '10 sep 2026' },
  ];

  ngOnInit(): void {
    this.centrosService.cargar();
    this.proyectosService.cargar();
    const emp = this.empresa();
    if (emp) this.solicitudesService.cargar(emp._id);
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

  irACentro(centro: CentroCosto): void {
    this.consumidorContext.seleccionarCentro(centro);
    this.router.navigate(['/mis-centros']);
  }

  irAProyecto(_proyecto: Proyecto): void {
    this.router.navigate(['/mis-proyectos']);
  }
}
