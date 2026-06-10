import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { TipoActividad, CreateTipoActividadDto, UpdateTipoActividadDto } from '../../shared/models/actividad.model';
import { Status } from '../../shared/models/status.model';

@Injectable({ providedIn: 'root' })
export class TiposActividadService {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);

  readonly tipos   = signal<TipoActividad[]>([]);
  readonly loading = signal(false);
  readonly status  = signal<Status | null>(null);

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }

  cargar(): void {
    this.loading.set(true);
    this.http.get<TipoActividad[]>(this.api.url('/tipos-actividad')).subscribe({
      next:  data => { this.tipos.set(data); this.loading.set(false); },
      error: err  => { this.loading.set(false); this.setError(err); },
    });
  }

  crear(dto: CreateTipoActividadDto): void {
    this.http.post<TipoActividad>(this.api.url('/tipos-actividad'), dto).subscribe({
      next:  tipo => { this.tipos.update(list => [...list, tipo]); this.status.set({ type: 'ok', text: 'Tipo creado correctamente' }); },
      error: err  => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateTipoActividadDto): void {
    this.http.put<TipoActividad>(this.api.url(`/tipos-actividad/${id}`), dto).subscribe({
      next:  updated => { this.tipos.update(list => list.map(t => t._id === id ? updated : t)); this.status.set({ type: 'ok', text: 'Tipo actualizado correctamente' }); },
      error: err     => this.setError(err),
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/tipos-actividad/${id}`)).subscribe({
      next:  () => { this.tipos.update(list => list.filter(t => t._id !== id)); this.status.set({ type: 'ok', text: 'Tipo eliminado' }); },
      error: err => this.setError(err),
    });
  }
}
