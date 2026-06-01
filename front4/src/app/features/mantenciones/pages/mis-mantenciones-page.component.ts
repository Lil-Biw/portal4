import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MantencionesService } from '../mantenciones.service';
import { TiposMantencionService } from '../tipos-mantencion.service';
import { CentrosService } from '../../centros/centros.service';
import { ActivosService } from '../../activos/activos.service';

import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { Mantencion, TipoMantencion } from '../../../shared/models/mantencion.model';
import { asId, toDateKey } from '../../../shared/utils';

type CalendarView = 'month' | 'week';

interface DayCell { date: Date; currentMonth: boolean; }

const DAYS   = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

@Component({
  selector: 'app-mis-mantenciones-page',
  standalone: true,
  imports: [FormsModule, SlicePipe],
  templateUrl: './mis-mantenciones-page.component.html',
  styleUrl: './mantenciones-page.component.css',
})
export class MisMantencionesPageComponent implements OnInit {
  protected readonly service        = inject(MantencionesService);
  protected readonly tiposService   = inject(TiposMantencionService);
  protected readonly centrosService = inject(CentrosService);
  private   readonly ctx            = inject(ConsumidorContextService);
  protected readonly activosService = inject(ActivosService);

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

  protected mantencionDetalle = signal<Mantencion | null>(null);

  protected activosDetalle = computed(() => {
    const m = this.mantencionDetalle();
    if (!m || !m.activo_ids?.length) return [];
    return this.activosService.activos().filter(a => m.activo_ids!.includes(asId(a._id)));
  });

  protected historialDetalle = computed(() => {
    const m = this.mantencionDetalle();
    if (!m) return [];
    const tipoId   = asId(typeof m.tipo_id === 'object' ? (m.tipo_id as TipoMantencion)._id : m.tipo_id as string);
    const centroId = asId(m.centro_costo_id);
    return this.service.mantenciones()
      .filter(x =>
        x._id !== m._id &&
        asId(typeof x.tipo_id === 'object' ? (x.tipo_id as TipoMantencion)._id : x.tipo_id as string) === tipoId &&
        asId(x.centro_costo_id) === centroId
      )
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 5);
  });

  protected mantencionesFiltradas = computed(() => {
    const empresa = this.ctx.empresaSeleccionada();
    const tipoId  = this.filtroTipoId();
    let list = this.service.mantenciones();
    if (empresa) {
      const ids = this.centroIdsPorEmpresa();
      list = list.filter(m => ids.has(asId(m.centro_costo_id)));
    }
    if (tipoId) {
      list = list.filter(m => asId(typeof m.tipo_id === 'object' ? (m.tipo_id as TipoMantencion)._id : m.tipo_id as string) === tipoId);
    }
    return list;
  });

  readonly days   = DAYS;
  readonly months = MONTHS;

  protected view      = signal<CalendarView>('month');
  protected reference = signal<Date>(new Date());

  protected monthLabel = computed(() => {
    const d = this.reference();
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });

  protected weekLabel = computed(() => {
    const start = this.weekStart();
    const end   = new Date(start); end.setDate(end.getDate() + 6);
    const fmt   = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}`;
    return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
  });

  protected calendarDays = computed((): DayCell[] => {
    const d = this.reference();
    const year = d.getFullYear(), month = d.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7;
    const cells: DayCell[] = [];
    for (let i = startDow - 1; i >= 0; i--) cells.push({ date: new Date(year, month, -i), currentMonth: false });
    for (let d2 = 1; d2 <= lastDay.getDate(); d2++) cells.push({ date: new Date(year, month, d2), currentMonth: true });
    while (cells.length < 42) {
      cells.push({ date: new Date(year, month + 1, cells.length - lastDay.getDate() - startDow + 1), currentMonth: false });
    }
    return cells;
  });

  protected weekStart = computed((): Date => {
    const d   = new Date(this.reference());
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  protected weekDays = computed((): Date[] => {
    const start = this.weekStart();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i); return d;
    });
  });

  protected centroNombre(m: Mantencion): string {
    return this.centrosService.centros().find(c => asId(c._id) === asId(m.centro_costo_id))?.nombre ?? '';
  }

  protected tipoDeMantencion(m: Mantencion): TipoMantencion | null {
    if (typeof m.tipo_id === 'object') return m.tipo_id as TipoMantencion;
    return this.tiposService.tipos().find(t => t._id === asId(m.tipo_id as string)) ?? null;
  }

  abrirDetalle(m: Mantencion): void { this.mantencionDetalle.set(m); }
  cerrarDetalle(): void { this.mantencionDetalle.set(null); }

  descargarDocMantencion(mantencionId: string, nombre: string, nombreDisplay?: string): void {
    this.service.descargarDocumento(mantencionId, nombre, nombreDisplay);
  }

  mantencionesEnDia(date: Date): Mantencion[] {
    const key = toDateKey(date);
    return this.mantencionesFiltradas().filter(m => m.fecha.slice(0, 10) === key);
  }

  colorDeMantencion(m: Mantencion): string {
    if (typeof m.tipo_id === 'object') return (m.tipo_id as TipoMantencion).color ?? '#9ca3af';
    return this.tiposService.tipos().find(t => t._id === asId(m.tipo_id as string))?.color ?? '#9ca3af';
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  navAnterior(): void {
    this.reference.update(d => {
      const n = new Date(d);
      if (this.view() === 'month') n.setMonth(n.getMonth() - 1);
      else n.setDate(n.getDate() - 7);
      return n;
    });
  }

  navSiguiente(): void {
    this.reference.update(d => {
      const n = new Date(d);
      if (this.view() === 'month') n.setMonth(n.getMonth() + 1);
      else n.setDate(n.getDate() + 7);
      return n;
    });
  }

  irAHoy(): void { this.reference.set(new Date()); }
  setView(v: CalendarView): void { this.view.set(v); }

  ngOnInit(): void {
    this.tiposService.cargar();
    this.service.cargar();
    this.centrosService.cargar();
    this.activosService.cargar();
  }
}

