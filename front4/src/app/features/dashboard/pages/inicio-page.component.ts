import { Component, OnInit, inject, computed, effect } from '@angular/core';
import { StatChipComponent, ChipVariant } from '../../../shared/components/stat-chip/stat-chip.component';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { SolicitudesService } from '../../solicitudes/solicitudes.service';
import { MantencionesService } from '../../mantenciones/mantenciones.service';
import { asId } from '../../../shared/utils';

interface ResumenSolicitudes {
  total: number;
  pct: number;
  pendiente: number;
  revision: number;
  aprobado: number;
  rechazado: number;
  vencido: number;
}

@Component({
  selector: 'app-inicio-page',
  standalone: true,
  imports: [StatChipComponent],
  templateUrl: './inicio-page.component.html',
})
export class InicioPageComponent implements OnInit {
  private readonly consumidorContext     = inject(ConsumidorContextService);
  protected readonly centrosService      = inject(CentrosService);
  protected readonly proyectosService    = inject(ProyectosService);
  protected readonly solicitudesService  = inject(SolicitudesService);
  protected readonly mantencionesService = inject(MantencionesService);

  readonly fecha = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  protected empresaSeleccionada = computed(() => this.consumidorContext.empresaSeleccionada());

  protected centrosDeEmpresa = computed(() => {
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === asId(empresa._id));
  });

  private centroIdsPorEmpresa = computed(() => {
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) return new Set<string>();
    return new Set(
      this.centrosService.centros()
        .filter(c => asId(c.cliente_id) === asId(empresa._id))
        .map(c => asId(c._id))
    );
  });

  protected tareasReales = computed(() =>
    this.solicitudesService.solicitudes()
      .filter(s => s.estado === 'pendiente' || s.estado === 'rechazado' || s.estado === 'vencido')
      .slice(0, 5)
  );

  protected proxMantenciones = computed(() => {
    const ids = this.centroIdsPorEmpresa();
    if (ids.size === 0) return [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return this.mantencionesService.mantenciones()
      .filter(m => ids.has(asId(m.centro_costo_id)) && new Date(m.fecha) >= hoy)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, 5);
  });

  protected scoreDocumental = computed(() => {
    const sols = this.solicitudesService.solicitudes();
    if (sols.length === 0) return { pct: 0, aprobados: 0, revision: 0, vencido: 0, rechazado: 0, pendiente: 0, total: 0 };
    const aprobados  = sols.filter(s => s.estado === 'aprobado').length;
    const revision   = sols.filter(s => s.estado === 'revision').length;
    const vencido    = sols.filter(s => s.estado === 'vencido').length;
    const rechazado  = sols.filter(s => s.estado === 'rechazado').length;
    const pendiente  = sols.filter(s => s.estado === 'pendiente').length;
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

  constructor() {
    effect(() => {
      const empresa = this.consumidorContext.empresaSeleccionada();
      if (empresa) this.solicitudesService.cargar(empresa._id);
      else this.solicitudesService.cargar('');
    });
  }

  ngOnInit(): void {
    this.centrosService.cargar();
    this.proyectosService.cargar();
    this.mantencionesService.cargar();
  }

  protected tareaColor(estado: string): string {
    if (estado === 'vencido' || estado === 'rechazado') return '#ef4444';
    return '#0095d6';
  }

  protected tareaLabel(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente', rechazado: 'Rechazado', vencido: 'Vencido',
    };
    return map[estado] ?? estado;
  }

  protected proxChip(fecha: string): { label: string; variant: ChipVariant } {
    const dias = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
    return dias <= 7 ? { label: 'Esta semana', variant: 'warning' } : { label: 'Próximo', variant: 'neutral' };
  }

  protected formatFechaShort(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  protected resumenPorCentro = computed((): Map<string, ResumenSolicitudes> => {
    const result = new Map<string, ResumenSolicitudes>();
    for (const centro of this.centrosDeEmpresa()) {
      const centroId = asId(centro._id);
      const proyectosIds = this.proyectosService.proyectos()
        .filter(p => asId(p.centro_costo_id) === centroId)
        .map(p => asId(p._id));
      const sols = this.solicitudesService.solicitudes()
        .filter(s => s.centro_costo_id === centroId || (s.proyecto_id && proyectosIds.includes(s.proyecto_id)));
      const aprobado = sols.filter(s => s.estado === 'aprobado').length;
      result.set(centroId, {
        total:     sols.length,
        pct:       sols.length > 0 ? Math.round((aprobado / sols.length) * 100) : 0,
        pendiente: sols.filter(s => s.estado === 'pendiente').length,
        revision:  sols.filter(s => s.estado === 'revision').length,
        aprobado,
        rechazado: sols.filter(s => s.estado === 'rechazado').length,
        vencido:   sols.filter(s => s.estado === 'vencido').length,
      });
    }
    return result;
  });

  resumenCentro(centroId: string): ResumenSolicitudes {
    return this.resumenPorCentro().get(centroId)
      ?? { total: 0, pct: 0, pendiente: 0, revision: 0, aprobado: 0, rechazado: 0, vencido: 0 };
  }

  readonly novedades: { tipo: string; titulo: string; fecha: string; chipVariant: ChipVariant }[] = [
    { tipo: 'Normativa',      titulo: 'Nueva resolución SEC tableros 2026',        fecha: '28 abr 2026', chipVariant: 'ok' },
    { tipo: 'Recomendación',  titulo: 'Checklist previo a auditorías eléctricas',  fecha: '15 abr 2026', chipVariant: 'ok' },
    { tipo: 'Servicio',       titulo: 'Nuevo servicio: monitoreo energético 24/7', fecha: '2 abr 2026',  chipVariant: 'ok' },
  ];
}
