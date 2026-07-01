import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { TipoProyecto, CreateTipoProyectoDto, UpdateTipoProyectoDto } from '../../shared/models/proyecto.model';
import { Status } from '../../shared/models/status.model';

@Injectable({ providedIn: 'root' })
export class TiposProyectoService {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);

  readonly tipos   = signal<TipoProyecto[]>([]);
  readonly loading = signal(false);
  readonly status  = signal<Status | null>(null);

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }

  cargar(): void {
    this.loading.set(true);
    this.http.get<TipoProyecto[]>(this.api.url('/tipos-proyecto')).subscribe({
      next:  data => { this.tipos.set(data); this.loading.set(false); },
      error: err  => { this.loading.set(false); this.setError(err); },
    });
  }

  crear(dto: CreateTipoProyectoDto): void {
    this.http.post<TipoProyecto>(this.api.url('/tipos-proyecto'), dto).subscribe({
      next:  tipo => { this.tipos.update(list => [...list, tipo]); this.status.set({ type: 'ok', text: 'Tipo creado correctamente' }); },
      error: err  => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateTipoProyectoDto): void {
    this.http.put<TipoProyecto>(this.api.url(`/tipos-proyecto/${id}`), dto).subscribe({
      next:  updated => { this.tipos.update(list => list.map(t => t._id === id ? updated : t)); this.status.set({ type: 'ok', text: 'Tipo actualizado correctamente' }); },
      error: err     => this.setError(err),
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/tipos-proyecto/${id}`)).subscribe({
      next:  () => { this.tipos.update(list => list.filter(t => t._id !== id)); this.status.set({ type: 'ok', text: 'Tipo eliminado' }); },
      error: err => this.setError(err),
    });
  }
}
