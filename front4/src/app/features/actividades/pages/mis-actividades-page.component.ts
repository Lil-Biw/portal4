import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActividadesService } from '../actividades.service';
import { TiposActividadService } from '../tipos-actividad.service';
import { CentrosService } from '../../centros/centros.service';
import { ActivosService } from '../../activos/activos.service';

import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { Actividad, TipoActividad } from '../../../shared/models/actividad.model';
import { asId, toDateKey } from '../../../shared/utils';
import { createCalendarState, CalendarView, CALENDAR_DAYS, CALENDAR_MONTHS } from '../../../shared/calendar-state';

@Component({
  selector: 'app-mis-actividades-page',
  standalone: true,
  imports: [FormsModule, SlicePipe],
  templateUrl: './mis-actividades-page.component.html',
  styleUrl: './actividades-page.component.css',
})
export class MisActividadesPageComponent implements OnInit {
  protected readonly service        = inject(ActividadesService);
  protected readonly tiposService   = inject(TiposActividadService);
  protected readonly centrosService = inject(CentrosService);
  private   readonly ctx            = inject(ConsumidorContextService);
  protected readonly activosService = inject(ActivosService);

  constructor() {
    effect(() => {
      const empresa = this.ctx.empresaSeleccionada();
      if (empresa) {
        const id = empresa._id as string;
        this.centrosService.cargarPorEmpresa(id);
        this.service.cargarPorEmpresa(id);
      } else {
        this.service.actividades.set([]);
      }
    });

    effect(() => {
      const empresa = this.ctx.empresaSeleccionada();
      const centroIds = [...this.centroIdsPorEmpresa()];
      if (empresa && centroIds.length > 0) {
        this.activosService.cargarPorCentros(asId(empresa._id), centroIds);
      }
    });
  }

  private centroIdsPorEmpresa = computed((): Set<string> => {
    const empresa = this.ctx.empresaSeleccionada();
    if (!empresa) return new Set();
    return new Set(
      this.centrosService.centros()
        .filter(c => asId(c.cliente_id) === asId(empresa._id))
        .map(c => asId(c._id))
    );
  });

  protected filtroTipoId = signal<string>('');

  protected actividadDetalle = signal<Actividad | null>(null);

  protected activosDetalle = computed(() => {
    const a = this.actividadDetalle();
    if (!a || !a.activo_ids?.length) return [];
    const todos = this.activosService.activos();
    return a.activo_ids.map(x => {
      if (typeof x === 'object' && x !== null) return x as import('../../../shared/models/activo.model').Activo;
      return todos.find(y => asId(y._id) === asId(x as string)) ?? null;
    }).filter((x): x is import('../../../shared/models/activo.model').Activo => x !== null);
  });

  protected historialDetalle = computed(() => {
    const a = this.actividadDetalle();
    if (!a) return [];
    const tipoId   = asId(typeof a.tipo_id === 'object' ? (a.tipo_id as TipoActividad)._id : a.tipo_id as string);
    const centroId = asId(a.centro_costo_id);
    return this.service.actividades()
      .filter(x =>
        x._id !== a._id &&
        asId(typeof x.tipo_id === 'object' ? (x.tipo_id as TipoActividad)._id : x.tipo_id as string) === tipoId &&
        asId(x.centro_costo_id) === centroId
      )
      .sort((x, y) => y.fecha.localeCompare(x.fecha))
      .slice(0, 5);
  });

  protected actividadesFiltradas = computed(() => {
    const empresa = this.ctx.empresaSeleccionada();
    const tipoId  = this.filtroTipoId();
    let list = this.service.actividades();
    if (empresa) {
      const ids = this.centroIdsPorEmpresa();
      list = list.filter(a => ids.has(asId(a.centro_costo_id)));
    }
    if (tipoId) {
      list = list.filter(a => asId(typeof a.tipo_id === 'object' ? (a.tipo_id as TipoActividad)._id : a.tipo_id as string) === tipoId);
    }
    return list;
  });

  readonly days   = CALENDAR_DAYS;
  readonly months = CALENDAR_MONTHS;

  private readonly _cal        = createCalendarState();
  protected readonly view       = this._cal.view;
  protected readonly reference  = this._cal.reference;
  protected readonly monthLabel  = this._cal.monthLabel;
  protected readonly weekLabel   = this._cal.weekLabel;
  protected readonly calendarDays = this._cal.calendarDays;
  protected readonly weekStart   = this._cal.weekStart;
  protected readonly weekDays    = this._cal.weekDays;
  navAnterior(): void  { this._cal.navAnterior(); }
  navSiguiente(): void { this._cal.navSiguiente(); }
  irAHoy(): void       { this._cal.irAHoy(); }
  setView(v: CalendarView): void { this._cal.setView(v); }
  isToday(date: Date): boolean   { return this._cal.isToday(date); }

  protected centroNombre(a: Actividad): string {
    return this.centrosService.centros().find(c => asId(c._id) === asId(a.centro_costo_id))?.nombre ?? '';
  }

  protected tipoDeActividad(a: Actividad): TipoActividad | null {
    if (typeof a.tipo_id === 'object') return a.tipo_id as TipoActividad;
    return this.tiposService.tipos().find(t => t._id === asId(a.tipo_id as string)) ?? null;
  }

  abrirDetalle(a: Actividad): void { this.actividadDetalle.set(a); }
  cerrarDetalle(): void { this.actividadDetalle.set(null); }

  descargarDocActividad(actividadId: string, nombre: string, nombreDisplay?: string): void {
    this.service.descargarDocumento(actividadId, nombre, nombreDisplay);
  }

  actividadesEnDia(date: Date): Actividad[] {
    const key = toDateKey(date);
    return this.actividadesFiltradas().filter(a => a.fecha.slice(0, 10) === key);
  }

  colorDeActividad(a: Actividad): string {
    if (typeof a.tipo_id === 'object') return (a.tipo_id as TipoActividad).color ?? '#9ca3af';
    return this.tiposService.tipos().find(t => t._id === asId(a.tipo_id as string))?.color ?? '#9ca3af';
  }

  ngOnInit(): void {
    this.tiposService.cargar();
  }
}
