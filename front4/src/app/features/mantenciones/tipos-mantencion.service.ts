import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { TipoMantencion, CreateTipoMantencionDto, UpdateTipoMantencionDto } from '../../shared/models/mantencion.model';
import { Status } from '../../shared/models/status.model';

@Injectable({ providedIn: 'root' })
export class TiposMantencionService {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);

  readonly tipos   = signal<TipoMantencion[]>([]);
  readonly loading = signal(false);
  readonly status  = signal<Status | null>(null);

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }

  cargar(): void {
    this.loading.set(true);
    this.http.get<TipoMantencion[]>(this.api.url('/tipos-mantencion')).subscribe({
      next:  data => { this.tipos.set(data); this.loading.set(false); },
      error: err  => { this.loading.set(false); this.setError(err); },
    });
  }

  crear(dto: CreateTipoMantencionDto): void {
    this.http.post<TipoMantencion>(this.api.url('/tipos-mantencion'), dto).subscribe({
      next:  tipo => { this.tipos.update(list => [...list, tipo]); this.status.set({ type: 'ok', text: 'Tipo creado correctamente' }); },
      error: err  => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateTipoMantencionDto): void {
    this.http.put<TipoMantencion>(this.api.url(`/tipos-mantencion/${id}`), dto).subscribe({
      next:  updated => { this.tipos.update(list => list.map(t => t._id === id ? updated : t)); this.status.set({ type: 'ok', text: 'Tipo actualizado correctamente' }); },
      error: err     => this.setError(err),
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/tipos-mantencion/${id}`)).subscribe({
      next:  () => { this.tipos.update(list => list.filter(t => t._id !== id)); this.status.set({ type: 'ok', text: 'Tipo eliminado' }); },
      error: err => this.setError(err),
    });
  }
}
