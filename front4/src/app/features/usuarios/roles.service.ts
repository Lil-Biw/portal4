import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Rol, CreateRolDto, UpdateRolDto } from '../../shared/models/permisos.model';
import { Status } from '../../shared/models/status.model';

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);

  readonly roles   = signal<Rol[]>([]);
  readonly status  = signal<Status | null>(null);
  readonly loading = signal(false);

  cargar(): void {
    this.loading.set(true);
    this.http.get<{ data: Rol[] } | Rol[]>(this.api.url('/roles')).subscribe({
      next: (res) => { this.roles.set(Array.isArray(res) ? res : res.data); this.loading.set(false); },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  crear(dto: CreateRolDto): void {
    this.http.post<Rol>(this.api.url('/roles'), dto).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Rol creado' }); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateRolDto): void {
    this.http.put<Rol>(this.api.url(`/roles/${id}`), dto).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Rol actualizado' }); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/roles/${id}`)).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Rol eliminado' }); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    const msg = err?.error?.message;
    this.status.set({ type: 'error', text: Array.isArray(msg) ? msg.join('. ') : (msg ?? 'Error inesperado') });
  }
}
