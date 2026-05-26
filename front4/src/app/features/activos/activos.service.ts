import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Activo, CreateActivoDto, UpdateActivoDto } from '../../shared/models/activo.model';
import { Status } from '../../shared/models/status.model';

@Injectable({ providedIn: 'root' })
export class ActivosService {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);

  readonly activos      = signal<Activo[]>([]);
  readonly seleccionado = signal<Activo | null>(null);
  readonly status       = signal<Status | null>(null);
  readonly loading      = signal(false);

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
    this.http.post<Activo>(this.api.url('/activos'), dto).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Activo creado correctamente' });
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateActivoDto): void {
    this.http.put<Activo>(this.api.url(`/activos/${id}`), dto).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Activo actualizado' });
        this.seleccionado.set(null);
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/activos/${id}`)).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Activo eliminado' });
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
