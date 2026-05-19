import { Component, OnInit, inject, computed, effect } from '@angular/core';
import { StatChipComponent, ChipVariant } from '../../../shared/components/stat-chip/stat-chip.component';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { SolicitudesService, EstadoSolicitud } from '../../solicitudes/solicitudes.service';
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
  private readonly consumidorContext    = inject(ConsumidorContextService);
  protected readonly centrosService     = inject(CentrosService);
  protected readonly proyectosService   = inject(ProyectosService);
  protected readonly solicitudesService = inject(SolicitudesService);

  readonly fecha = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  protected empresaSeleccionada = computed(() => this.consumidorContext.empresaSeleccionada());

  protected centrosDeEmpresa = computed(() => {
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === asId(empresa._id));
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

  readonly tareas = [
    { titulo: 'Protocolo seguridad 2026',                color: '#ef4444', fecha: 'Vencido' },
    { titulo: 'Confirmar recepción informe eléctrico',   color: '#f59e0b', fecha: 'Hoy'     },
    { titulo: 'Subir boleta consumo mayo',               color: '#0095d6', fecha: '5 may'   },
  ];

  readonly mantenciones: { titulo: string; detalle: string; chipLabel: string; chipVariant: ChipVariant }[] = [
    { titulo: 'Revisión tablero principal',  detalle: '7 may 2026 · Planta Norte',  chipLabel: 'Esta semana', chipVariant: 'warning' },
    { titulo: 'Auditoría eléctrica anual',   detalle: '18 jun 2026 · Planta Norte', chipLabel: 'Próximo',     chipVariant: 'neutral' },
    { titulo: 'Termografía instalaciones',   detalle: '2 ago 2026 · Bodega Sur',    chipLabel: 'Próximo',     chipVariant: 'neutral' },
  ];

  readonly novedades: { tipo: string; titulo: string; fecha: string; chipVariant: ChipVariant }[] = [
    { tipo: 'Normativa',      titulo: 'Nueva resolución SEC tableros 2026',        fecha: '28 abr 2026', chipVariant: 'ok' },
    { tipo: 'Recomendación',  titulo: 'Checklist previo a auditorías eléctricas',  fecha: '15 abr 2026', chipVariant: 'ok' },
    { tipo: 'Servicio',       titulo: 'Nuevo servicio: monitoreo energético 24/7', fecha: '2 abr 2026',  chipVariant: 'ok' },
  ];
}
