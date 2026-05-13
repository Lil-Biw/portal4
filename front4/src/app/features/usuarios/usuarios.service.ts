import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Usuario, CreateUsuarioDto, UpdateUsuarioDto, PermisoItem } from '../../shared/models/usuario.model';
import { Status } from '../../shared/models/status.model';
import { asId } from '../../shared/utils';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);

  readonly usuarios = signal<Usuario[]>([]);
  readonly seleccionado = signal<Usuario | null>(null);
  readonly permisosSeleccionados = signal<string[]>([]);
  readonly status = signal<Status | null>(null);
  readonly loading = signal(false);

  cargar(): void {
    this.loading.set(true);
    this.http.get<{ data: Usuario[] } | Usuario[]>(this.api.url('/usuarios')).subscribe({
      next: (res) => { this.usuarios.set(Array.isArray(res) ? res : res.data); this.loading.set(false); },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  cargarPermisos(usuarioId: string): void {
    if (!usuarioId) { this.permisosSeleccionados.set([]); return; }
    this.http.get<{ centro_costo_id: string }[]>(this.api.url(`/permisos/usuario/${usuarioId}`)).subscribe({
      next: (res) => this.permisosSeleccionados.set(res.map(p => asId(p.centro_costo_id)).filter(Boolean)),
      error: () => this.permisosSeleccionados.set([]),
    });
  }

  crear(dto: CreateUsuarioDto, permisos: PermisoItem[]): void {
    this.http.post<Usuario>(this.api.url('/usuarios'), { ...dto, permisos }).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Usuario creado correctamente' }); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateUsuarioDto): void {
    this.http.put<Usuario>(this.api.url(`/usuarios/${id}`), dto).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Usuario actualizado' }); this.seleccionado.set(null); this.permisosSeleccionados.set([]); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/usuarios/${id}`)).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Usuario eliminado' }); this.seleccionado.set(null); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  seleccionar(usuario: Usuario): void {
    this.seleccionado.set(usuario);
    this.cargarPermisos(usuario._id);
    this.clearStatus();
  }

  togglePermiso(centroId: string, checked: boolean): void {
    const set = new Set(this.permisosSeleccionados());
    checked ? set.add(centroId) : set.delete(centroId);
    this.permisosSeleccionados.set(Array.from(set));
  }

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }
}
