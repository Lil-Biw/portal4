import { Component, OnInit, OnDestroy, inject, computed, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CentrosService } from '../centros.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { SolicitudesService } from '../../solicitudes/solicitudes.service';
import { DocumentosService } from '../../documentos/documentos.service';
import { ActivosService } from '../../activos/activos.service';
import { SpiderChartComponent } from '../../../shared/components/spider-chart/spider-chart.component';
import { StatChipComponent, ChipVariant } from '../../../shared/components/stat-chip/stat-chip.component';
import { CentroCosto } from '../../../shared/models/centro.model';
import { asId } from '../../../shared/utils';

@Component({
  selector: 'app-mis-centros-page',
  standalone: true,
  imports: [NgIf, FormsModule, SpiderChartComponent, StatChipComponent],
  templateUrl: './mis-centros-page.component.html',
  styles: [`
    .centro-card {
      cursor: pointer;
      transition: box-shadow .15s, border-color .15s;
      border: 1px solid rgba(34,33,33,.12);
    }
    .centro-card:hover {
      box-shadow: 0 4px 16px rgba(0,149,214,.18);
      border-color: rgba(0,149,214,.35);
    }
  `],
})
export class MisCentrosPageComponent implements OnInit, OnDestroy {
  private  readonly consumidorContext  = inject(ConsumidorContextService);
  private  readonly router             = inject(Router);
  protected readonly service           = inject(CentrosService);
  protected readonly solicitudesService = inject(SolicitudesService);
  protected readonly documentosService  = inject(DocumentosService);
  protected readonly activosService     = inject(ActivosService);
  private  readonly sanitizer          = inject(DomSanitizer);

  get empresa()        { return this.consumidorContext.empresaSeleccionada(); }
  get centroActivo()   { return this.consumidorContext.centroSeleccionado(); }

  protected centros = computed(() => {
    const emp = this.consumidorContext.empresaSeleccionada();
    if (!emp) return [];
    return this.service.centros().filter(c => asId(c.cliente_id) === asId(emp._id));
  });

  protected mostrarBuscar = signal(false);
  protected busqueda       = signal('');

  protected centrosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.centros();
    return this.centros().filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      c.codigo.toLowerCase().includes(q) ||
      (c.ubicacion_ciudad ?? '').toLowerCase().includes(q) ||
      (c.ubicacion_region ?? '').toLowerCase().includes(q)
    );
  });

  toggleBuscar(): void {
    this.mostrarBuscar.update(v => !v);
    if (!this.mostrarBuscar()) this.busqueda.set('');
  }

  // ── Spider chart data (mock por ahora) ──────────────────────────────────
  readonly spiderLabels = [
    'RRHH y\ndocumentación',
    'Normativa',
    'Suministro',
    'Seguridad\nOperacional',
    'Continuidad\nOperacional',
  ];
  readonly spiderValues = [72, 58, 84, 67, 75];

  // ── Score documental del centro ─────────────────────────────────────────
  protected scoreDelCentro = computed(() => {
    const centro = this.consumidorContext.centroSeleccionado();
    if (!centro) return { pct: 0, aprobados: 0, revision: 0, vencido: 0, rechazado: 0, pendiente: 0, total: 0 };
    const sols = this.solicitudesService.solicitudes()
      .filter(s => s.centro_costo_id === asId(centro._id));
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

  protected solicitudesDelCentro = computed(() => {
    const centro = this.consumidorContext.centroSeleccionado();
    if (!centro) return [];
    return this.solicitudesService.solicitudes()
      .filter(s => asId(s.centro_costo_id) === asId(centro._id) && !s.proyecto_id);
  });

  scoreDeCentro(centroId: string) {
    const sols = this.solicitudesService.solicitudes()
      .filter(s => s.centro_costo_id === centroId);
    if (sols.length === 0) return { pct: 0, aprobados: 0, revision: 0, vencido: 0, rechazado: 0, pendiente: 0, total: 0 };
    const aprobados = sols.filter(s => s.estado === 'aprobado').length;
    return {
      pct: Math.round((aprobados / sols.length) * 100),
      aprobados,
      revision:  sols.filter(s => s.estado === 'revision').length,
      vencido:   sols.filter(s => s.estado === 'vencido').length,
      rechazado: sols.filter(s => s.estado === 'rechazado').length,
      pendiente: sols.filter(s => s.estado === 'pendiente').length,
      total: sols.length,
    };
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

  protected scoreChipVariant = computed((): ChipVariant => {
    const pct = this.scoreDelCentro().pct;
    if (pct >= 80) return 'ok';
    if (pct >= 50) return 'warning';
    return 'danger';
  });

  protected scoreChipLabel = computed((): string => {
    const pct = this.scoreDelCentro().pct;
    if (pct >= 80) return 'Bueno';
    if (pct >= 50) return 'Regular';
    return 'Bajo';
  });

  // ── Map URL ─────────────────────────────────────────────────────────────
  protected mapUrl = computed((): SafeResourceUrl => {
    const c = this.consumidorContext.centroSeleccionado();
    if (!c) return '';
    const parts = [c.ubicacion_direccion, c.ubicacion_ciudad, c.ubicacion_region, c.ubicacion_pais]
      .filter(Boolean).join(', ');
    const q = encodeURIComponent(parts || c.nombre);
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://maps.google.com/maps?q=${q}&output=embed&z=14`
    );
  });

  ngOnInit(): void {
    this.service.cargar();
    const emp = this.empresa;
    if (emp) this.solicitudesService.cargar(emp._id);
  }

  // Limpia el centro al salir de esta página
  ngOnDestroy(): void {
    this.consumidorContext.seleccionarCentro(null);
  }

  seleccionarCentro(centro: CentroCosto): void {
    this.consumidorContext.seleccionarCentro(centro);
    const emp = this.empresa;
    if (emp) this.documentosService.cargar('centro', emp.razon_social, centro.nombre);
    this.activosService.cargar(asId(centro._id));
  }

  irADocumentos(tab: 'documentacion' | 'solicitudes'): void {
    const c = this.centroActivo;
    this.router.navigate(['/documentos'], {
      queryParams: { tab, ...(c ? { centroId: asId(c._id) } : {}) },
    });
  }

  volver(): void {
    this.consumidorContext.seleccionarCentro(null);
  }
}
