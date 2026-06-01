import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Activo, CreateActivoDto, UpdateActivoDto } from '../../shared/models/activo.model';
import { Status } from '../../shared/models/status.model';
import { CentrosService } from '../centros/centros.service';

@Injectable({ providedIn: 'root' })
export class ActivosService {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);
  private readonly centrosService = inject(CentrosService);

  readonly activos      = signal<Activo[]>([]);
  readonly seleccionado = signal<Activo | null>(null);
  readonly status       = signal<Status | null>(null);
  readonly loading      = signal(false);

  // Admin: carga todos los activos, opcionalmente filtrados por centro (endpoint plano admin)
  cargar(centroCostoId?: string): void {
    this.loading.set(true);
    const url = centroCostoId
      ? this.api.url(`/activos?centro_costo_id=${centroCostoId}`)
      : this.api.url('/activos');
    this.http.get<Activo[]>(url).subscribe({
      next: (res) => { this.activos.set(res); this.loading.set(false); },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  crear(dto: CreateActivoDto): void {
    const empresaId = this.centrosService.centros().find(c => c._id === dto.centro_costo_id)?.cliente_id;
    if (!empresaId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.post<Activo>(
      this.api.url(`/empresas/${empresaId}/centros/${dto.centro_costo_id}/activos`),
      dto
    ).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Activo creado correctamente' });
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateActivoDto): void {
    const centroId = dto.centro_costo_id ?? this.seleccionado()?.centro_costo_id;
    const empresaId = this.centrosService.centros().find(c => c._id === centroId)?.cliente_id;
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.put<Activo>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${id}`),
      dto
    ).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Activo actualizado' });
        this.seleccionado.set(null);
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  eliminar(id: string): void {
    const centroId = this.seleccionado()?.centro_costo_id;
    const empresaId = this.centrosService.centros().find(c => c._id === centroId)?.cliente_id;
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.delete(this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${id}`)).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Activo desactivado correctamente' });
        this.seleccionado.set(null);
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  seleccionar(activo: Activo): void {
    this.seleccionado.set(activo);
    this.clearStatus();
  }

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }
}
