import { Component, inject, computed, effect, untracked, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { SolicitudesService } from '../../solicitudes/solicitudes.service';
import { DocumentosService } from '../../documentos/documentos.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { ActividadesService } from '../../actividades/actividades.service';
import { FormsModule } from '@angular/forms';
import { StatChipComponent, ChipVariant } from '../../../shared/components/stat-chip/stat-chip.component';
import { SpiderChartComponent } from '../../../shared/components/spider-chart/spider-chart.component';
import { ClientesService } from '../../clientes/clientes.service';
import { CentroCosto } from '../../../shared/models/centro.model';
import { Proyecto } from '../../../shared/models/proyecto.model';
import { ApiService } from '../../../core/services/api.service';
import { asId, calcularScoreDocumental, scoreChipVariantFn, scoreChipLabelFn, estadoStyleFn, porcentajeColorFn } from '../../../shared/utils';

@Component({
  selector: 'app-mi-ficha-page',
  standalone: true,
  imports: [StatChipComponent, SpiderChartComponent, FormsModule],
  templateUrl: './mi-ficha-page.component.html',
})
export class MiFichaPageComponent {
  private readonly consumidorContext   = inject(ConsumidorContextService);
  private readonly solicitudesService  = inject(SolicitudesService);
  private readonly documentosService   = inject(DocumentosService);
  private readonly centrosService      = inject(CentrosService);
  private readonly api                 = inject(ApiService);

  constructor() {
    // Centros y solicitudes ya se cargan globalmente en TopbarComponent
    // al cambiar empresaSeleccionada — aquí solo se recarga lo que es
    // exclusivo de esta página.
    effect(() => {
      const emp = this.consumidorContext.empresaSeleccionada();
      if (emp) {
        untracked(() => this.proyectosService.cargarPorEmpresa(emp._id));
      }
    });

    effect(() => {
      const emp       = this.consumidorContext.empresaSeleccionada();
      const centros   = this.centrosDeEmpresa();
      const proyectos = this.proyectosDeEmpresa();
      if (!emp) return;
      untracked(() => {
        this.documentosService.cargarEmpresa(emp._id);
        this.documentosService.cargarVencidos(emp._id);
        this.documentosService.cargarTodosCentros(emp._id, centros);
        this.documentosService.cargarTodosProyectos(emp._id, proyectos, centros);
      });
    });
  }
  private readonly proyectosService    = inject(ProyectosService);
  private readonly actividadesService  = inject(ActividadesService);
  private readonly router              = inject(Router);
  private readonly clientesService     = inject(ClientesService);

  protected empresa = computed(() => this.consumidorContext.empresaSeleccionada());

  protected imagenUrl = computed(() => {
    const emp = this.empresa();
    if (!emp?._id || !emp?.imagen?.tipo_mime) return null;
    return this.api.url(`/empresas/${emp._id}/imagen`);
  });

  protected logoUrl = computed(() => {
    const emp = this.empresa();
    if (!emp?._id || !emp?.logo?.tipo_mime) return null;
    return this.api.url(`/empresas/${emp._id}/logo`);
  });

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

  protected actividadesDeEmpresa = computed(() => {
    const ids = this.centroIdsPorEmpresa();
    if (ids.size === 0) return [];
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    hace30.setHours(0, 0, 0, 0);
    return this.actividadesService.actividades()
      .filter(a => ids.has(asId(a.centro_costo_id)) && new Date(a.fecha) >= hace30)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 3);
  });

  protected proyectosDeEmpresa = computed(() => {
    const emp = this.consumidorContext.empresaSeleccionada();
    if (!emp) return [];
    return this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === asId(emp._id));
  });

  protected scoreDocumental = computed(() => {
    const docsActivos =
      this.documentosService.documentosEmpresa().length +
      this.documentosService.documentosPorCentro().reduce((s, g) => s + g.docs.length, 0) +
      this.documentosService.documentosPorProyecto().reduce((s, g) => s + g.docs.length, 0);
    const docsVencidos = this.documentosService.documentosVencidos().length;
    return calcularScoreDocumental(this.solicitudesService.solicitudes(), docsActivos, docsVencidos);
  });

  protected solicitudesEmpresa = computed(() =>
    this.solicitudesService.solicitudes()
  );

  protected docsNivelEmpresa = computed(() =>
    this.solicitudesService.solicitudes()
      .filter(s => !s.centro_costo_id && !s.proyecto_id)
  );

  protected scoreChipVariant = computed((): ChipVariant => scoreChipVariantFn(this.scoreDocumental().pct));

  protected scoreChipLabel = computed((): string => scoreChipLabelFn(this.scoreDocumental().pct));

  protected porcentajeColor(pct: number): string {
    return porcentajeColorFn(pct);
  }

  readonly spiderLabels = [
    'RRHH y\ndocumentación',
    'Normativa',
    'Suministro',
    'Seguridad\nOperacional',
    'Continuidad\nOperacional',
  ];

  protected mostrarPromedio = computed(() => {
    const empId = this.empresa()?._id;
    const emp = empId ? (this.clientesService.clientes().find(c => c._id === empId) ?? this.empresa()) : null;
    return emp?.mostrar_grafico_promedio ?? false;
  });

  protected spiderValuesPromedio = computed<number[]>(() => {
    const centros = this.centrosDeEmpresa();
    if (centros.length === 0) return [];
    return Array.from({ length: 5 }, (_, i) =>
      Math.round(centros.reduce((s, c) => s + (c.score_smartclarity?.[i] ?? 5), 0) / centros.length) * 10
    );
  });

  protected spiderValues = computed<number[]>(() => {
    const empId = this.empresa()?._id;
    if (!empId) return [50, 50, 50, 50, 50];
    const emp = this.clientesService.clientes().find(c => c._id === empId) ?? this.empresa();
    const raw = emp?.score_smartclarity;
    if (raw && raw.length === 5) return raw.map(v => v * 10);
    return [50, 50, 50, 50, 50];
  });

  readonly certificados = [
    { nombre: 'Certificado ISO 9001',      vencimiento: '30 nov 2026' },
    { nombre: 'Certificado OHSAS 18001',   vencimiento: '15 ago 2026' },
  ];


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
    const revision = sols.filter(s => s.estado === 'revision').length;
    const base = `${sols.length} doc${sols.length !== 1 ? 's' : ''}`;
    if (revision > 0) return `${base} · ${revision} en revisión`;
    return `${base} · al día`;
  }

  // Resumen de solicitudes para un proyecto
  resumenProyecto(proyectoId: string): string {
    const sols = this.solicitudesService.solicitudes()
      .filter(s => s.proyecto_id === proyectoId);
    if (sols.length === 0) return 'Sin solicitudes';
    const revision = sols.filter(s => s.estado === 'revision').length;
    const base = `${sols.length} doc${sols.length !== 1 ? 's' : ''}`;
    if (revision > 0) return `${base} · ${revision} en revisión`;
    return `${base} · al día`;
  }

  protected readonly estadoStyle = estadoStyleFn;

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
