import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { CentroCosto, CreateCentroDto, UpdateCentroDto } from '../../shared/models/centro.model';
import { Status } from '../../shared/models/status.model';

@Injectable({ providedIn: 'root' })
export class CentrosService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);

  readonly centros = signal<CentroCosto[]>([]);
  readonly seleccionado = signal<CentroCosto | null>(null);
  readonly status = signal<Status | null>(null);
  readonly loading = signal(false);

  cargar(): void {
    this.loading.set(true);
    this.http.get<{ data: CentroCosto[] } | CentroCosto[]>(this.api.url('/centros-costos')).subscribe({
      next: (res) => {
        this.centros.set(Array.isArray(res) ? res : res.data);
        this.loading.set(false);
      },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  crear(dto: CreateCentroDto): void {
    this.http.post<CentroCosto>(this.api.url('/centros-costos'), dto).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Centro creado correctamente' }); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateCentroDto): void {
    this.http.put<CentroCosto>(this.api.url(`/centros-costos/${id}`), dto).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Centro actualizado' });
        this.seleccionado.set(null);
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/centros-costos/${id}`)).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Centro eliminado' });
        this.seleccionado.set(null);
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  seleccionar(centro: CentroCosto): void {
    this.seleccionado.set(centro);
    this.clearStatus();
  }

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }
}
