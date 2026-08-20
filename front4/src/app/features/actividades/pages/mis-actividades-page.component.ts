import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActividadesService } from '../actividades.service';
import { ActividadIconoComponent } from '../components/actividad-icono/actividad-icono.component';
import { TiposActividadService } from '../tipos-actividad.service';
import { CentrosService } from '../../centros/centros.service';
import { ActivosService } from '../../activos/activos.service';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { AuthService } from '../../auth/auth.service';

import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { Actividad, TipoActividad } from '../../../shared/models/actividad.model';
import { Activo, TipoActivo } from '../../../shared/models/activo.model';
import { Usuario } from '../../../shared/models/usuario.model';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { UploadDocumentFormComponent } from '../../../shared/components/upload-document-form/upload-document-form.component';
import { DocumentCardListComponent } from '../../../shared/components/document-card-list/document-card-list.component';
import { DocumentoTarjeta } from '../../../shared/models/documento-tarjeta.model';
import { asId, confirmarEliminacion, toDateKey, usuarioEstaSuscrito, actividadEnDia, posicionActividadEnDia, ordenarMultiDiaPrimero, barrasMultiDiaPorSemana, BarraMultiDia, layoutPorHora, BloqueHorario, rangoHora as formatRangoHora } from '../../../shared/utils';
import { createCalendarState, CalendarView, CALENDAR_DAYS, CALENDAR_MONTHS, DayCell } from '../../../shared/calendar-state';
import { ICONOS_ACTIVIDAD } from '../actividades-icons';

interface ActividadForm {
  nombre: string;
  descripcion: string;
  tipo_id: string;
  empresa_id: string;
  centro_costo_id: string;
  activo_ids: string[];
  fecha: string;
  fecha_termino: string;
  hora: string;
  hora_termino: string;
  // Perfil consumidor: el líder es texto libre, no una referencia a un usuario.
  liderNombre: string;
}

function emptyForm(fecha = ''): ActividadForm {
  return { nombre: '', descripcion: '', tipo_id: '', empresa_id: '', centro_costo_id: '', activo_ids: [], fecha, fecha_termino: '', hora: '', hora_termino: '', liderNombre: '' };
}

interface TipoForm {
  nombre: string;
  color: string;
  icono: string;
  descripcion: string;
}

function emptyTipoForm(): TipoForm {
  return { nombre: '', color: '#4E9AC7', icono: 'calendario', descripcion: '' };
}

@Component({
  selector: 'app-mis-actividades-page',
  standalone: true,
  imports: [FormsModule, SlicePipe, ActividadIconoComponent, StatusBannerComponent, UploadDocumentFormComponent, DocumentCardListComponent],
  templateUrl: './mis-actividades-page.component.html',
  styleUrl: './actividades-page.component.css',
})
export class MisActividadesPageComponent implements OnInit {
  protected readonly service        = inject(ActividadesService);
  protected readonly tiposService   = inject(TiposActividadService);
  protected readonly centrosService = inject(CentrosService);
  private   readonly ctx            = inject(ConsumidorContextService);
  protected readonly activosService = inject(ActivosService);
  protected readonly usuariosService = inject(UsuariosService);
  protected readonly authService     = inject(AuthService);

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

    effect(() => {
      if (this.tiposService.status()?.type === 'ok' && this.showTipoForm()) {
        this.cerrarTipoForm();
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

  protected filtroTiposIds = signal<string[]>([]);

  toggleFiltroTipo(id: string): void {
    this.filtroTiposIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }

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

  private tipoIdDe(a: Actividad): string {
    return asId(typeof a.tipo_id === 'object' ? (a.tipo_id as TipoActividad)._id : a.tipo_id as string);
  }

  protected historialDetalle = computed(() => {
    const a = this.actividadDetalle();
    if (!a) return [];
    const tipoId   = this.tipoIdDe(a);
    const centroId = asId(a.centro_costo_id);
    return this.service.actividades()
      .filter(x =>
        x._id !== a._id &&
        this.tipoIdDe(x) === tipoId &&
        asId(x.centro_costo_id) === centroId
      )
      .sort((x, y) => y.fecha.localeCompare(x.fecha))
      .slice(0, 5);
  });

  protected actividadesFiltradas = computed(() => {
    const empresa = this.ctx.empresaSeleccionada();
    const tipoIds = this.filtroTiposIds();
    let list = this.service.actividades();
    if (empresa) {
      const ids = this.centroIdsPorEmpresa();
      list = list.filter(a => ids.has(asId(a.centro_costo_id)));
    }
    if (tipoIds.length > 0) {
      list = list.filter(a => tipoIds.includes(this.tipoIdDe(a)));
    }
    return list;
  });

  readonly days   = CALENDAR_DAYS;
  readonly months = CALENDAR_MONTHS;

  private readonly _cal            = createCalendarState();
  protected readonly view           = this._cal.view;
  protected readonly reference      = this._cal.reference;
  protected readonly monthLabel     = this._cal.monthLabel;
  protected readonly weekLabel      = this._cal.weekLabel;
  protected readonly dayLabel       = this._cal.dayLabel;
  protected readonly calendarDays   = this._cal.calendarDays;
  protected readonly weekStart      = this._cal.weekStart;
  protected readonly weekDays       = this._cal.weekDays;
  navAnterior(): void  { this._cal.navAnterior(); }
  navSiguiente(): void { this._cal.navSiguiente(); }
  irAHoy(): void       { this._cal.irAHoy(); }
  setView(v: CalendarView): void { this._cal.setView(v); }
  isToday(date: Date): boolean   { return this._cal.isToday(date); }

  irADetalleDia(date: Date): void {
    this.reference.set(date);
    this.setView('day');
  }

  protected actividadSeleccionadaDia = signal<Actividad | null>(null);
  protected lupaActivosDia = signal(false);

  seleccionarActividadDia(a: Actividad): void {
    this.actividadSeleccionadaDia.set(a);
    this.actividadDetalle.set(a);
    this.lupaActivosDia.set(false);
    this.service.listarDocumentos(a._id);
  }

  protected centroNombre(a: Actividad): string {
    return this.centrosService.centros().find(c => asId(c._id) === asId(a.centro_costo_id))?.nombre ?? '';
  }

  protected tipoDeActividad(a: Actividad): TipoActividad | null {
    // Prioriza el tipo "vivo" del signal sobre el objeto embebido en la
    // actividad: si se edita el color/nombre de un tipo, las actividades ya
    // cargadas no se vuelven a pedir al backend y quedarían con datos viejos.
    const vivo = this.tiposService.tipos().find(t => asId(t._id) === this.tipoIdDe(a));
    if (vivo) return vivo;
    return typeof a.tipo_id === 'object' ? (a.tipo_id as TipoActividad) : null;
  }

  abrirDetalle(a: Actividad): void {
    this.actividadDetalle.set(a);
    this.service.listarDocumentos(a._id);
  }
  cerrarDetalle(): void { this.actividadDetalle.set(null); }

  descargarDocActividad(actividadId: string, docId: string, nombreDisplay?: string): void {
    this.service.descargarDocumento(actividadId, docId, nombreDisplay);
  }

  abrirDocActividad(linkUrl: string): void {
    window.open(linkUrl, '_blank');
  }

  actividadesEnDia(date: Date): Actividad[] {
    const key = toDateKey(date);
    return this.actividadesFiltradas().filter(a => actividadEnDia(a, key));
  }

  // Vista Mes: las multi-día se quedan como un chip más dentro de la celda
  // (sin barra); el detalle de hora/continuidad se ve en Semana o Día. Van
  // primero para no perderse con el tope de "primeras 2" y para que el chip
  // conector (--inicio/--medio/--fin) quede alineado día a día.
  primerasActividadesEnDia(date: Date): Actividad[] {
    return ordenarMultiDiaPrimero(this.actividadesEnDia(date), toDateKey(date)).slice(0, 2);
  }

  posicionEnDia(a: Actividad, date: Date): 'unico' | 'inicio' | 'medio' | 'fin' {
    return posicionActividadEnDia(a, toDateKey(date));
  }

  // Vista Mes agrupada por semana, para la franja zebra (ver .cal-week-row:nth-child(2n)).
  protected readonly semanasDelMes = computed((): DayCell[][] => {
    const dias = this.calendarDays();
    const semanas: DayCell[][] = [];
    for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7));
    return semanas;
  });

  barrasSemanaActual(): { barras: BarraMultiDia<Actividad>[]; filas: number } {
    return barrasMultiDiaPorSemana(this.actividadesFiltradas(), this.weekDays());
  }

  // Grilla horaria (Semana): actividades de un solo día sin hora van en la
  // franja "Sin hora"; las multi-día se dibujan aparte como barra (barrasSemanaActual).
  actividadesSinHoraUnicas(date: Date): Actividad[] {
    const key = toDateKey(date);
    return this.actividadesEnDia(date).filter(a => !a.hora && posicionActividadEnDia(a, key) === 'unico');
  }

  // Vista Día: no hay "semana" sobre la cual dibujar una barra, así que la
  // franja "Sin hora" muestra también las multi-día (como un ítem más de la lista).
  actividadesSinHoraDia(date: Date): Actividad[] {
    return this.actividadesEnDia(date).filter(a => !a.hora);
  }

  bloquesHorarios(date: Date): BloqueHorario<Actividad>[] {
    return layoutPorHora(this.actividadesEnDia(date).filter(a => !!a.hora));
  }

  // Grilla horaria (Semana/Día): rango fijo 07:00–21:00, filas de 48px.
  protected readonly horasGrid = Array.from({ length: 15 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`);
  private readonly ROW_PX = 48;
  private readonly GRID_INICIO_MIN = 7 * 60;

  topPxDeHora(inicioMin: number): number {
    return (inicioMin - this.GRID_INICIO_MIN) * (this.ROW_PX / 60);
  }

  alturaBloquePx(duracionMin: number): number {
    return Math.max(duracionMin, 30) * (this.ROW_PX / 60);
  }

  rangoHora(a: Actividad): string {
    return formatRangoHora(a);
  }

  colorDeActividad(a: Actividad): string {
    // Literal hex (== --fg-5): ActividadIconoComponent hace `color + '26'` para el
    // fondo tintado, y eso solo produce un hex válido si `color` es un hex literal.
    if (typeof a.tipo_id === 'object') return (a.tipo_id as TipoActividad).color ?? '#A6AFB8';
    return this.tiposService.tipos().find(t => t._id === this.tipoIdDe(a))?.color ?? '#A6AFB8';
  }

  protected readonly iconosActividad = ICONOS_ACTIVIDAD;

  protected puedeGestionarTipos = computed(() =>
    this.authService.tienePermiso('catalogos', 'crear') ||
    this.authService.tienePermiso('catalogos', 'editar') ||
    this.authService.tienePermiso('catalogos', 'eliminar')
  );

  // El backend adjunta puede_editar/puede_eliminar por actividad cuando el
  // usuario es consumidor (rol 'usuario'): catálogo + centro asignado + la
  // actividad la creó él mismo u otro usuario de su empresa. Si el flag no
  // viene (super_admin en modo consumidor), se cae al permiso del catálogo.
  protected puedeEditarActividad(a: Actividad): boolean {
    return a.puede_editar ?? this.authService.tienePermiso('actividades', 'editar');
  }

  protected puedeEliminarActividad(a: Actividad): boolean {
    return a.puede_eliminar ?? this.authService.tienePermiso('actividades', 'eliminar');
  }

  // La vista consumidor trabaja siempre sobre la empresa del contexto, así que
  // el select de empresa del wizard muestra únicamente esa empresa.
  protected empresasContext = computed(() => {
    const e = this.ctx.empresaSeleccionada();
    return e ? [e] : [];
  });

  protected centrosParaEmpresa = computed(() => {
    const empId = this.form().empresa_id;
    if (!empId) return [];
    let centros = this.centrosService.centros().filter(c => asId(c.cliente_id) === empId);
    // Perfil consumidor: el select solo ofrece los centros asignados al usuario
    // (el backend revalida igual en create con autorizarCreacion). Si el campo
    // no viene (sesión previa al cambio) se muestran todos para no romperlas.
    const usuario = this.authService.usuarioActual();
    if (usuario?.rol === 'usuario' && Array.isArray(usuario.centros_asignados)) {
      const asignados = new Set(usuario.centros_asignados.map(asId));
      centros = centros.filter(c => asignados.has(asId(c._id)));
    }
    return centros;
  });

  protected activosParaCentro = computed(() =>
    this.activosService.activos().filter(a => asId(a.centro_costo_id) === this.form().centro_costo_id)
  );

  protected filtroActivo = signal('');

  protected activosFiltrados = computed(() => {
    const q = this.filtroActivo().toLowerCase().trim();
    const activos = this.activosParaCentro();
    if (!q) return activos;
    return activos.filter(a =>
      a.nombre.toLowerCase().includes(q) ||
      this.tipoActivoNombre(a).toLowerCase().includes(q)
    );
  });

  tipoActivoNombre(a: Activo): string {
    if (typeof a.tipo_activo_id === 'object') return (a.tipo_activo_id as TipoActivo).nombre;
    return '';
  }

  protected usuariosParaCentro = computed(() => {
    const centroId = this.form().centro_costo_id;
    if (!centroId) return [];
    return this.usuariosService.usuarios().filter(u =>
      u.rol === 'usuario' && u.centros_asignados.some(c => asId(c) === centroId)
    );
  });

  protected notifNotificar   = signal(true);
  protected notifTab         = signal<'usuarios' | 'admins' | 'super-admins'>('usuarios');
  protected notifUsuariosIds = signal<string[]>([]);
  protected notifAdminsIds   = signal<string[]>([]);
  protected notifSuperAdmins = signal(false);

  protected readonly opcionesDiasRecordatorio = [
    { valor: 365, label: '1 año antes' },
    { valor: 180, label: '6 meses antes' },
    { valor: 30,  label: '30 días antes' },
    { valor: 15,  label: '15 días antes' },
    { valor: 7,   label: '7 días antes' },
    { valor: 3,   label: '3 días antes' },
    { valor: 1,   label: '1 día antes' },
    { valor: 0,   label: 'El día de la actividad' },
  ];
  protected diasRecordatorio = signal<number[]>([365, 180, 30, 15, 7, 3, 1, 0]);

  toggleDiaRecordatorio(valor: number): void {
    this.diasRecordatorio.update(dias =>
      dias.includes(valor) ? dias.filter(d => d !== valor) : [...dias, valor]
    );
  }

  protected notifTodosUsuariosSeleccionados = computed(() => {
    const u = this.usuariosParaCentro();
    return u.length > 0 && u.every(x => this.notifUsuariosIds().includes(x._id));
  });

  protected notifTodosAdminsSeleccionados = computed(() => {
    const a = this.adminsParaEmpresa();
    return a.length > 0 && a.every(x => this.notifAdminsIds().includes(x._id));
  });

  protected adminsParaEmpresa = computed(() =>
    this.usuariosService.usuarios().filter(u => u.rol === 'admin_smartclarity')
  );

  protected estaSuscritoAdmin(u: Usuario): boolean {
    const f = this.form();
    return usuarioEstaSuscrito(u, f.empresa_id, f.centro_costo_id);
  }

  protected adminsSuscritosIds = computed(() =>
    this.adminsParaEmpresa().filter(u => this.estaSuscritoAdmin(u)).map(u => u._id)
  );

  protected resumenTipoNombre = computed(() =>
    this.tiposService.tipos().find(t => t._id === this.form().tipo_id)?.nombre ?? ''
  );
  protected resumenEmpresaNombre = computed(() =>
    this.ctx.empresaSeleccionada()?.razon_social ?? ''
  );
  protected resumenCentroNombre = computed(() =>
    this.centrosService.centros().find(c => asId(c._id) === this.form().centro_costo_id)?.nombre ?? ''
  );
  protected resumenNotificaciones = computed(() => {
    if (!this.notifNotificar()) return 'Sin notificaciones';
    const u = this.notifUsuariosIds().length;
    const a = this.notifAdminsIds().length;
    const s = this.notifSuperAdmins();
    const parts: string[] = [];
    if (u > 0) parts.push(`${u} usuario${u > 1 ? 's' : ''}`);
    if (a > 0) parts.push(`${a} admin${a > 1 ? 's' : ''}`);
    if (s)     parts.push('super admins');
    return parts.length > 0 ? parts.join(' · ') : 'Sin destinatarios';
  });

  protected resumenActivosTexto = computed(() => {
    const n = this.form().activo_ids.length;
    return n > 0 ? `${n} activo${n > 1 ? 's' : ''} incluido${n > 1 ? 's' : ''}` : 'Sin activos';
  });

  protected resumenActivosLista = computed(() => {
    const ids = this.form().activo_ids;
    return this.activosService.activos()
      .filter(a => ids.includes(a._id))
      .map(a => a.nombre);
  });

  protected resumenNotifLista = computed(() => {
    if (!this.notifNotificar()) return [];
    const items: string[] = [];
    const todos = this.usuariosService.usuarios();
    for (const id of this.notifUsuariosIds()) {
      const u = todos.find(x => x._id === id);
      if (u) items.push(u.nombre);
    }
    for (const id of this.notifAdminsIds()) {
      const u = todos.find(x => x._id === id);
      if (u) items.push(`${u.nombre} (admin)`);
    }
    if (this.notifSuperAdmins()) items.push('Todos los super admins');
    return items;
  });

  protected resumenDocumentosLista = computed(() => {
    if (this.editingId()) {
      return this.service.documentosActividad().map(d => d.nombre_display);
    }
    return this.docsPendientes.map(d => d.nombre);
  });

  protected showResumenActivos = signal(false);
  protected showResumenNotif   = signal(false);
  protected modalLupa          = signal<'activos' | 'notif' | 'docs' | null>(null);
  protected tipoDropdownOpen   = signal(false);

  protected tipoSeleccionado = computed(() =>
    this.tiposService.tipos().find(t => t._id === this.form().tipo_id) ?? null
  );

  seleccionarTipo(tipoId: string): void {
    this.patchForm('tipo_id', tipoId);
    this.tipoDropdownOpen.set(false);
  }

  get resumenDocumentosTexto(): string {
    if (this.editingId()) {
      const docs = this.service.documentosActividad();
      return docs.length > 0 ? `${docs.length} archivo${docs.length > 1 ? 's' : ''}` : 'Sin documentos';
    }
    return this.docsPendientes.length > 0
      ? `${this.docsPendientes.length} archivo${this.docsPendientes.length > 1 ? 's' : ''} por subir`
      : 'Sin documentos';
  }

  // ── Wizard ───────────────────────────────────────────────────────
  protected paso             = signal<1 | 2 | 3 | 4>(1);
  protected pasoMaxAlcanzado = signal<1 | 2 | 3 | 4>(1);
  protected errorPaso1       = signal('');

  protected showModal     = signal(false);
  protected editingId     = signal<string | null>(null);
  protected form          = signal<ActividadForm>(emptyForm());
  protected confirmDelete = signal<string | null>(null);

  protected docsPendientes: { localId: string; file?: File; linkUrl?: string; nombre: string }[] = [];
  protected docLinkInput = '';
  protected docModo      = signal<'archivo' | 'link'>('archivo');
  protected subiendoDocs = false;
  protected subiendoCards    = signal<{ id: string; nombre: string }[]>([]);
  protected eliminandoDocIds = signal<Set<string>>(new Set());

  protected pendienteLinkInput = '';
  protected pendienteModo      = signal<'archivo' | 'link'>('archivo');

  private nuevoIdLocal(prefijo: string): string {
    return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  setPendienteModo(modo: 'archivo' | 'link'): void {
    if (this.pendienteModo() === modo) return;
    this.pendienteModo.set(modo);
    this.pendienteLinkInput = '';
  }

  setDocModo(modo: 'archivo' | 'link'): void {
    if (this.docModo() === modo) return;
    this.docModo.set(modo);
    this.docLinkInput = '';
  }

  pendienteLinkInvalido(): boolean {
    const link = this.pendienteLinkInput.trim();
    if (!link) return false;
    return !/^https?:\/\/.+/i.test(link);
  }

  docLinkInvalido(): boolean {
    const link = this.docLinkInput.trim();
    if (!link) return false;
    return !/^https?:\/\/.+/i.test(link);
  }

  onPendienteArchivoChange(file: File | null): void {
    if (!file) return;
    this.docsPendientes.push({ localId: this.nuevoIdLocal('pend'), file, nombre: file.name });
  }

  agregarDocPendienteLink(): void {
    const link = this.pendienteLinkInput.trim();
    if (!link || this.pendienteLinkInvalido()) return;
    this.docsPendientes.push({ localId: this.nuevoIdLocal('pend'), linkUrl: link, nombre: link });
    this.pendienteLinkInput = '';
  }

  quitarDocPendiente(localId: string): void {
    this.docsPendientes = this.docsPendientes.filter(d => d.localId !== localId);
  }

  protected get docsPendientesTarjetas(): DocumentoTarjeta[] {
    return this.docsPendientes.map(d => ({
      id: d.localId,
      nombre: d.nombre,
      tipoContenido: d.linkUrl ? 'link' : 'archivo',
      linkUrl: d.linkUrl,
      estado: 'pendiente' as const,
    }));
  }

  onDocArchivoChange(file: File | null): void {
    if (!file) return;
    const id = this.editingId();
    if (!id) return;
    const tempId = this.nuevoIdLocal('subiendo');
    this.subiendoCards.update(list => [...list, { id: tempId, nombre: file.name }]);
    const limpiar = () => this.subiendoCards.update(list => list.filter(c => c.id !== tempId));
    this.service.subirDocumento(id, file, undefined, limpiar, limpiar);
  }

  agregarDocLink(): void {
    const id = this.editingId();
    if (!id) return;
    const link = this.docLinkInput.trim();
    if (!link || this.docLinkInvalido()) return;
    this.service.subirDocumentoLink(id, link);
    this.docLinkInput = '';
  }

  protected get documentosTarjetas(): DocumentoTarjeta[] {
    const subidos: DocumentoTarjeta[] = this.service.documentosActividad().map(doc => ({
      id: doc._id,
      nombre: doc.nombre_display,
      tipoContenido: doc.tipo_contenido ?? 'archivo',
      linkUrl: doc.link_url,
      estado: this.eliminandoDocIds().has(doc._id) ? 'eliminando' as const : 'listo' as const,
    }));
    const subiendo: DocumentoTarjeta[] = this.subiendoCards().map(c => ({
      id: c.id,
      nombre: c.nombre,
      tipoContenido: 'archivo' as const,
      estado: 'subiendo' as const,
    }));
    return [...subidos, ...subiendo];
  }

  eliminarDocActividad(docId: string): void {
    const id = this.editingId();
    if (!id) return;
    const nombre = this.service.documentosActividad().find(d => d._id === docId)?.nombre_display;
    if (!confirmarEliminacion(nombre ?? 'este documento')) return;
    this.eliminandoDocIds.update(set => new Set(set).add(docId));
    const limpiar = () => this.eliminandoDocIds.update(set => {
      const copia = new Set(set);
      copia.delete(docId);
      return copia;
    });
    this.service.eliminarDocumento(id, docId, limpiar, limpiar);
  }

  renombrarDocActividad(ev: { id: string; nuevoNombre: string }): void {
    const id = this.editingId();
    if (!id) return;
    this.service.renombrarDocumento(id, ev.id, ev.nuevoNombre);
  }

  descargarDocActividadWizard(docId: string, nombreDisplay?: string): void {
    const id = this.editingId();
    if (!id) return;
    this.service.descargarDocumento(id, docId, nombreDisplay);
  }

  descargarDocResumen(actividadId: string, docId: string, nombreDisplay?: string): void {
    this.service.descargarDocumento(actividadId, docId, nombreDisplay);
  }

  get actividadEditando() {
    const id = this.editingId();
    return id ? this.service.actividades().find(a => a._id === id) ?? null : null;
  }

  private subirDocsPendientesSecuencial(actividadId: string, index: number): void {
    if (index >= this.docsPendientes.length) {
      this.docsPendientes = [];
      this.subiendoDocs = false;
      this.cerrarModal();
      return;
    }
    const { file, linkUrl, nombre } = this.docsPendientes[index];
    const onSuccess = () => { this.subirDocsPendientesSecuencial(actividadId, index + 1); };
    const onError = () => { this.subiendoDocs = false; };
    if (linkUrl) {
      this.service.subirDocumentoLink(actividadId, linkUrl, nombre, onSuccess, onError);
    } else if (file) {
      this.service.subirDocumento(actividadId, file, nombre, onSuccess, onError);
    }
  }

  toggleNotifNotificar(): void { this.notifNotificar.update(v => !v); }
  toggleSeleccionarTodosUsuarios(): void {
    if (this.notifTodosUsuariosSeleccionados()) {
      this.notifUsuariosIds.set([]);
    } else {
      this.notifUsuariosIds.set(this.usuariosParaCentro().map(u => u._id));
    }
  }
  toggleSeleccionarTodosAdmins(): void {
    if (this.notifTodosAdminsSeleccionados()) {
      this.notifAdminsIds.set(this.adminsSuscritosIds());
    } else {
      this.notifAdminsIds.set(this.adminsParaEmpresa().map(u => u._id));
    }
  }
  toggleNotifUsuario(id: string): void {
    this.notifUsuariosIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }
  toggleNotifAdmin(id: string): void {
    if (this.adminsSuscritosIds().includes(id)) return;
    this.notifAdminsIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }

  private resetNotif(): void {
    this.notifNotificar.set(true);
    this.notifTab.set('usuarios');
    this.notifUsuariosIds.set(this.usuariosParaCentro().map(u => u._id));
    this.notifAdminsIds.set(this.adminsSuscritosIds());
    this.notifSuperAdmins.set(false);
    this.diasRecordatorio.set([365, 180, 30, 15, 7, 3, 1, 0]);
  }

  private validarPaso1(): boolean {
    const f = this.form();
    if (!f.nombre.trim())   { this.errorPaso1.set('El nombre es requerido.');       return false; }
    if (!f.tipo_id)         { this.errorPaso1.set('Selecciona un tipo.');            return false; }
    if (!f.fecha)           { this.errorPaso1.set('La fecha es requerida.');         return false; }
    if (f.fecha_termino && f.fecha_termino < f.fecha) {
      this.errorPaso1.set('La fecha de término no puede ser anterior a la fecha de inicio.');
      return false;
    }
    if (!f.centro_costo_id) { this.errorPaso1.set('Selecciona un centro de costos.'); return false; }
    this.errorPaso1.set('');
    return true;
  }

  avanzar(): void {
    const p = this.paso();
    if (p === 1 && !this.validarPaso1()) return;
    if (p < 4) {
      const next = (p + 1) as 1 | 2 | 3 | 4;
      this.paso.set(next);
      if (next > this.pasoMaxAlcanzado()) this.pasoMaxAlcanzado.set(next);
    }
  }

  retroceder(): void {
    const p = this.paso();
    if (p > 1) this.paso.set((p - 1) as 1 | 2 | 3 | 4);
  }

  irAPaso(n: 1 | 2 | 3 | 4): void {
    if (n > this.pasoMaxAlcanzado()) return;
    this.paso.set(n);
  }

  abrirCrear(fecha = ''): void {
    this.editingId.set(null);
    this.form.set(emptyForm(fecha));
    const emp = this.ctx.empresaSeleccionada();
    if (emp) this.form.update(f => ({ ...f, empresa_id: asId(emp._id) }));
    this.docsPendientes = [];
    this.subiendoCards.set([]);
    this.eliminandoDocIds.set(new Set());
    this.resetNotif();
    this.paso.set(1);
    this.pasoMaxAlcanzado.set(1);
    this.errorPaso1.set('');
    this.filtroActivo.set('');
    this.showResumenActivos.set(false);
    this.showResumenNotif.set(false);
    this.showModal.set(true);
    this.service.clearStatus();
  }

  abrirEditar(a: Actividad): void {
    this.editingId.set(a._id);
    this.filtroActivo.set('');
    this.subiendoCards.set([]);
    this.eliminandoDocIds.set(new Set());
    const centroId = asId(a.centro_costo_id);
    const centro = this.centrosService.centros().find(c => asId(c._id) === centroId);
    this.form.set({
      nombre:          a.nombre,
      descripcion:     a.descripcion ?? '',
      tipo_id:         asId(typeof a.tipo_id === 'object' ? (a.tipo_id as TipoActividad)._id : a.tipo_id),
      empresa_id:      centro ? asId(centro.cliente_id) : '',
      centro_costo_id: centroId,
      activo_ids:      (a.activo_ids ?? []).map(x => asId(typeof x === 'object' ? (x as { _id: string })._id : x)),
      fecha:           a.fecha.slice(0, 10),
      fecha_termino:   a.fecha_termino ? a.fecha_termino.slice(0, 10) : '',
      hora:            a.hora ?? '',
      hora_termino:    a.hora_termino ?? '',
      liderNombre:     a.lider_nombre ?? '',
    });
    this.resetNotif();
    this.diasRecordatorio.set([...(a.dias_recordatorio ?? [])]);
    this.paso.set(1);
    this.pasoMaxAlcanzado.set(4);
    this.errorPaso1.set('');
    this.showResumenActivos.set(false);
    this.showResumenNotif.set(false);
    this.showModal.set(true);
    this.service.clearStatus();
    this.service.listarDocumentos(a._id);
  }

  cerrarModal(): void {
    this.showModal.set(false);
    this.editingId.set(null);
    this.confirmDelete.set(null);
    this.paso.set(1);
    this.pasoMaxAlcanzado.set(1);
    this.errorPaso1.set('');
    this.showResumenActivos.set(false);
    this.showResumenNotif.set(false);
    this.modalLupa.set(null);
  }

  patchForm(field: keyof ActividadForm, value: string | string[]): void {
    if (field === 'centro_costo_id') {
      this.form.update(f => ({ ...f, centro_costo_id: value as string, activo_ids: [] }));
      this.filtroActivo.set('');
      this.notifUsuariosIds.set(this.usuariosParaCentro().map(u => u._id));
      this.notifAdminsIds.update(ids => [...new Set([...ids, ...this.adminsSuscritosIds()])]);
    } else if (field === 'empresa_id') {
      this.form.update(f => ({ ...f, empresa_id: value as string }));
      this.notifAdminsIds.set(this.adminsSuscritosIds());
    } else if (field === 'hora' && !value) {
      this.form.update(f => ({ ...f, hora: '', hora_termino: '' }));
    } else {
      this.form.update(f => ({ ...f, [field]: value }));
    }
  }

  toggleActivo(activoId: string): void {
    this.form.update(f => {
      const ids = f.activo_ids.includes(activoId)
        ? f.activo_ids.filter(id => id !== activoId)
        : [...f.activo_ids, activoId];
      return { ...f, activo_ids: ids };
    });
  }

  guardar(): void {
    const f = this.form();
    if (!f.nombre.trim() || !f.tipo_id || !f.centro_costo_id || !f.fecha) return;
    const notif      = this.notifNotificar();
    const todosU     = this.usuariosParaCentro().map(u => u._id);
    const todosA     = this.adminsParaEmpresa().map(u => u._id);
    const selU       = this.notifUsuariosIds();
    const selA       = this.notifAdminsIds();
    const esCompleto = todosU.every(id => selU.includes(id)) && todosA.every(id => selA.includes(id));
    const superAdmins = this.notifSuperAdmins();
    const destinatariosAct = [...selU, ...selA];
    const notificacion = !notif
      ? { notificar: false }
      : esCompleto
        ? { notificar: true, audiencia: 'todos' as const, notificar_super_admins: superAdmins }
        : destinatariosAct.length > 0
          ? { notificar: true, audiencia: 'especificos' as const, destinatarios_ids: destinatariosAct, notificar_super_admins: superAdmins }
          : { notificar: false };
    const id = this.editingId();
    const dto = {
      nombre:            f.nombre.trim(),
      descripcion:       f.descripcion.trim() || undefined,
      tipo_id:           f.tipo_id,
      centro_costo_id:   f.centro_costo_id,
      activo_ids:        f.activo_ids.length > 0 ? f.activo_ids : undefined,
      fecha:             f.fecha,
      fecha_termino:     f.fecha_termino || null,
      hora:              f.hora || undefined,
      hora_termino:      f.hora && f.hora_termino ? f.hora_termino : undefined,
      lider_nombre:      f.liderNombre.trim(),
      dias_recordatorio: this.diasRecordatorio(),
      documentos_nombres: !id && this.docsPendientes.length > 0
        ? this.docsPendientes.map(d => d.nombre)
        : undefined,
      notificacion,
    };
    if (id) {
      this.service.actualizar(id, dto, () => this.cerrarModal());
    } else {
      this.service.crear(dto, (nueva) => {
        if (this.docsPendientes.length === 0) {
          this.cerrarModal();
          return;
        }
        this.subiendoDocs = true;
        this.editingId.set(nueva._id);
        this.subirDocsPendientesSecuencial(nueva._id, 0);
      });
    }
  }

  eliminarActividad(id: string): void {
    const act = this.service.actividades().find(a => a._id === id);
    if (act && !confirmarEliminacion(act.nombre)) return;
    this.service.eliminar(id);
    this.confirmDelete.set(null);
    this.cerrarModal();
  }

  protected showTiposModal = signal(false);
  protected editingTipoId  = signal<string | null>(null);
  protected tipoForm       = signal<TipoForm>(emptyTipoForm());
  protected showTipoForm   = signal(false);

  abrirTiposModal(): void {
    this.editingTipoId.set(null);
    this.tipoForm.set(emptyTipoForm());
    this.showTipoForm.set(false);
    this.tiposService.clearStatus();
    this.showTiposModal.set(true);
  }

  cerrarTiposModal(): void {
    this.showTiposModal.set(false);
    this.editingTipoId.set(null);
    this.showTipoForm.set(false);
  }

  abrirNuevoTipo(): void {
    this.editingTipoId.set(null);
    this.tipoForm.set(emptyTipoForm());
    this.showTipoForm.set(true);
    this.tiposService.clearStatus();
  }

  abrirEditarTipo(t: TipoActividad): void {
    this.editingTipoId.set(t._id);
    this.tipoForm.set({ nombre: t.nombre, color: t.color, icono: t.icono ?? '', descripcion: t.descripcion ?? '' });
    this.showTipoForm.set(true);
    this.tiposService.clearStatus();
  }

  cerrarTipoForm(): void {
    this.showTipoForm.set(false);
    this.editingTipoId.set(null);
  }

  patchTipoForm(field: keyof TipoForm, value: string): void {
    this.tipoForm.update(f => ({ ...f, [field]: value }));
  }

  guardarTipo(): void {
    const f = this.tipoForm();
    if (!f.nombre.trim()) return;
    const dto = { nombre: f.nombre.trim(), color: f.color, icono: f.icono || undefined, descripcion: f.descripcion.trim() || undefined };
    const id = this.editingTipoId();
    if (id) this.tiposService.actualizar(id, dto);
    else    this.tiposService.crear(dto);
  }

  eliminarTipo(id: string): void {
    const tipo = this.tiposService.tipos().find(t => t._id === id);
    if (tipo && !confirmarEliminacion(`el tipo de actividad ${tipo.nombre}`)) return;
    this.tiposService.eliminar(id);
  }

  ngOnInit(): void {
    this.tiposService.cargar();
    this.usuariosService.cargar();
  }
}
