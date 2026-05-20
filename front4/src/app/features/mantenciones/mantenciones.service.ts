import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Mantencion, CreateMantencionDto, UpdateMantencionDto } from '../../shared/models/mantencion.model';
import { Status } from '../../shared/models/status.model';

@Injectable({ providedIn: 'root' })
export class MantencionesService {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);

  readonly mantenciones = signal<Mantencion[]>([]);
  readonly loading      = signal(false);
  readonly status       = signal<Status | null>(null);

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }

  cargar(centroCostoId?: string): void {
    this.loading.set(true);
    const qs = centroCostoId ? `?centro_costo_id=${centroCostoId}` : '';
    this.http.get<Mantencion[]>(`${this.api.url('/mantenciones')}${qs}`).subscribe({
      next:  data => { this.mantenciones.set(data); this.loading.set(false); },
      error: err  => { this.loading.set(false); this.setError(err); },
    });
  }

  crear(dto: CreateMantencionDto): void {
    this.http.post<Mantencion>(this.api.url('/mantenciones'), dto).subscribe({
      next: m => {
        this.mantenciones.update(list => [...list, m].sort((a, b) => a.fecha.localeCompare(b.fecha)));
        this.status.set({ type: 'ok', text: 'Mantención creada correctamente' });
      },
      error: err => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateMantencionDto): void {
    this.http.put<Mantencion>(this.api.url(`/mantenciones/${id}`), dto).subscribe({
      next: updated => {
        this.mantenciones.update(list =>
          list.map(m => m._id === id ? updated : m).sort((a, b) => a.fecha.localeCompare(b.fecha))
        );
        this.status.set({ type: 'ok', text: 'Mantención actualizada correctamente' });
      },
      error: err => this.setError(err),
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/mantenciones/${id}`)).subscribe({
      next: () => {
        this.mantenciones.update(list => list.filter(m => m._id !== id));
        this.status.set({ type: 'ok', text: 'Mantención eliminada' });
      },
      error: err => this.setError(err),
    });
  }
}
