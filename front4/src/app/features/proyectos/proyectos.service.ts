import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Proyecto, CreateProyectoDto, UpdateProyectoDto } from '../../shared/models/proyecto.model';
import { Status } from '../../shared/models/status.model';

@Injectable({ providedIn: 'root' })
export class ProyectosService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);

  readonly proyectos = signal<Proyecto[]>([]);
  readonly seleccionado = signal<Proyecto | null>(null);
  readonly status = signal<Status | null>(null);
  readonly loading = signal(false);

  cargar(): void {
    this.loading.set(true);
    this.http.get<{ data: Proyecto[] } | Proyecto[]>(this.api.url('/proyectos')).subscribe({
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

  crear(dto: CreateProyectoDto): void {
    this.http.post<Proyecto>(this.api.url('/proyectos'), dto).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Proyecto creado correctamente' }); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateProyectoDto): void {
    this.http.put<Proyecto>(this.api.url(`/proyectos/${id}`), dto).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Proyecto actualizado' }); this.seleccionado.set(null); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/proyectos/${id}`)).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Proyecto eliminado' }); this.seleccionado.set(null); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  seleccionar(proyecto: Proyecto): void { this.seleccionado.set(proyecto); this.clearStatus(); }
  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }
}
