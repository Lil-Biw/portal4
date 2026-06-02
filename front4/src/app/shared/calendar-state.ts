import { signal, computed } from '@angular/core';

export type CalendarView = 'month' | 'week';
export interface DayCell { date: Date; currentMonth: boolean; }

export const CALENDAR_DAYS   = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const CALENDAR_MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export function createCalendarState() {
  const view      = signal<CalendarView>('month');
  const reference = signal<Date>(new Date());

  const monthLabel = computed(() => {
    const d = reference();
    return `${CALENDAR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });

  const weekStart = computed((): Date => {
    const d   = new Date(reference());
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const weekLabel = computed(() => {
    const start = weekStart();
    const end   = new Date(start); end.setDate(end.getDate() + 6);
    const fmt   = (d: Date) => `${d.getDate()} ${CALENDAR_MONTHS[d.getMonth()].slice(0, 3)}`;
    return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
  });

  const calendarDays = computed((): DayCell[] => {
    const d = reference();
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

  const weekDays = computed((): Date[] => {
    const start = weekStart();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i); return d;
    });
  });

  function navAnterior() {
    reference.update(d => {
      const n = new Date(d);
      if (view() === 'month') n.setMonth(n.getMonth() - 1);
      else n.setDate(n.getDate() - 7);
      return n;
    });
  }

  function navSiguiente() {
    reference.update(d => {
      const n = new Date(d);
      if (view() === 'month') n.setMonth(n.getMonth() + 1);
      else n.setDate(n.getDate() + 7);
      return n;
    });
  }

  function irAHoy()               { reference.set(new Date()); }
  function setView(v: CalendarView) { view.set(v); }

  function isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  return { view, reference, monthLabel, weekLabel, calendarDays, weekStart, weekDays, navAnterior, navSiguiente, irAHoy, setView, isToday };
}
