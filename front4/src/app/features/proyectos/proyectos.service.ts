import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Proyecto, CreateProyectoDto, UpdateProyectoDto } from '../../shared/models/proyecto.model';
import { Status } from '../../shared/models/status.model';
import { AuthService } from '../auth/auth.service';
import { NOTIFY_COOLDOWN_MS } from '../../shared/utils';

@Injectable({ providedIn: 'root' })
export class ProyectosService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private statusTimer: ReturnType<typeof setTimeout> | null = null;

  readonly proyectos = signal<Proyecto[]>([]);
  readonly seleccionado = signal<Proyecto | null>(null);
  readonly status = signal<Status | null>(null);
  readonly loading = signal(false);
  readonly centrosSeleccionados = signal<string[]>([]);

  toggleCentro(centroId: string, checked: boolean): void {
    const set = new Set(this.centrosSeleccionados());
    if (checked) set.add(centroId); else set.delete(centroId);
    this.centrosSeleccionados.set(Array.from(set));
  }

  // Admin: carga todos los proyectos (endpoint plano admin).
  // Sin `estado`, el backend excluye los eliminados por defecto; pasar un
  // estado explícito para filtrar por uno de los 7 estados del flujo.
  cargar(estado?: string): void {
    this.loading.set(true);
    const url = estado ? this.api.url(`/proyectos?estado=${estado}`) : this.api.url('/proyectos');
    this.http.get<{ data: Proyecto[] } | Proyecto[]>(url).subscribe({
      next: (res) => { this.proyectos.set(Array.isArray(res) ? res : res.data); this.loading.set(false); },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  cargarUno(id: string): void {
    this.loading.set(true);
    this.http.get<Proyecto>(this.api.url(`/proyectos/${id}`)).subscribe({
      next: (p) => { this.seleccionado.set(p); this.loading.set(false); },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  // Consumidor: carga todos los proyectos de una empresa
  cargarPorEmpresa(empresaId: string): void {
    this.loading.set(true);
    this.http.get<{ data: Proyecto[] } | Proyecto[]>(this.api.url(`/empresas/${empresaId}/proyectos`)).subscribe({
      next: (res) => { this.proyectos.set(Array.isArray(res) ? res : res.data); this.loading.set(false); },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  // Consumidor: carga los proyectos vinculados a un centro de costo
  cargarParaConsumidor(empresaId: string, centroId: string): void {
    this.loading.set(true);
    this.http.get<{ data: Proyecto[] } | Proyecto[]>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/proyectos`)
    ).subscribe({
      next: (res) => { this.proyectos.set(Array.isArray(res) ? res : res.data); this.loading.set(false); },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  // Consumidor: carga un proyecto con contexto de empresa y centro
  cargarUnoConContexto(empresaId: string, centroId: string, id: string): void {
    this.loading.set(true);
    this.http.get<Proyecto>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/proyectos/${id}`)
    ).subscribe({
      next: (p) => { this.seleccionado.set(p); this.loading.set(false); },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  crear(dto: CreateProyectoDto): void {
    const centroId = dto.centro_costo_ids?.[0];
    if (!centroId) { this.setError({ error: { message: 'Selecciona al menos un centro de costos' } }); return; }
    this.http.post<Proyecto>(
      this.api.url(`/empresas/${dto.cliente_id}/centros/${centroId}/proyectos`),
      dto
    ).subscribe({
      next: () => { this.setStatus({ type: 'ok', text: 'Proyecto creado correctamente' }); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateProyectoDto): void {
    const empresaId = dto.cliente_id ?? this.seleccionado()?.cliente_id;
    const centroId  = dto.centro_costo_ids?.[0] ?? this.seleccionado()?.centro_costo_ids?.[0];
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Contexto de empresa/centro no disponible' } }); return; }
    this.http.put<Proyecto>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/proyectos/${id}`),
      dto
    ).subscribe({
      next: () => { this.setStatus({ type: 'ok', text: 'Proyecto actualizado' }); this.seleccionado.set(null); this.centrosSeleccionados.set([]); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  eliminar(id: string): void {
    const empresaId = this.seleccionado()?.cliente_id;
    const centroId  = this.seleccionado()?.centro_costo_ids?.[0];
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Contexto de empresa/centro no disponible' } }); return; }
    this.http.delete(this.api.url(`/empresas/${empresaId}/centros/${centroId}/proyectos/${id}`)).subscribe({
      next: () => { this.setStatus({ type: 'ok', text: 'Proyecto eliminado' }); this.seleccionado.set(null); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  seleccionar(proyecto: Proyecto): void {
    this.seleccionado.set(proyecto);
    this.centrosSeleccionados.set([...(proyecto.centro_costo_ids ?? [])]);
    this.clearStatus();
  }
  clearStatus(): void {
    if (this.statusTimer) { clearTimeout(this.statusTimer); this.statusTimer = null; }
    this.status.set(null);
  }

  private setStatus(status: Status): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.status.set(status);
    this.statusTimer = setTimeout(() => { this.status.set(null); this.statusTimer = null; }, NOTIFY_COOLDOWN_MS);
  }

  private setError(err: { error?: { message?: string } }): void {
    this.setStatus({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }
}
