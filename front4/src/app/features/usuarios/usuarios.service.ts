import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Usuario, CreateUsuarioDto, UpdateUsuarioDto, SuscripcionesDto } from '../../shared/models/usuario.model';
import { PermisosUsuario } from '../../shared/models/permisos.model';
import { Status } from '../../shared/models/status.model';
import { asId } from '../../shared/utils';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);

  readonly usuarios          = signal<Usuario[]>([]);
  readonly seleccionado      = signal<Usuario | null>(null);
  readonly centrosSeleccionados = signal<string[]>([]);
  readonly status            = signal<Status | null>(null);
  readonly loading           = signal(false);

  cargar(): void {
    this.loading.set(true);
    this.http.get<{ data: Usuario[] } | Usuario[]>(this.api.url('/usuarios?limit=1000')).subscribe({
      next: (res) => { this.usuarios.set(Array.isArray(res) ? res : res.data); this.loading.set(false); },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  crear(dto: CreateUsuarioDto): void {
    this.http.post<Usuario>(this.api.url('/usuarios'), dto).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Usuario creado. Se enviaron las credenciales por correo.' }); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateUsuarioDto): void {
    this.http.put<Usuario>(this.api.url(`/usuarios/${id}`), dto).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Usuario actualizado' });
        this.seleccionado.set(null);
        this.centrosSeleccionados.set([]);
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  actualizarSuscripciones(id: string, dto: SuscripcionesDto): void {
    this.http.patch<Usuario>(this.api.url(`/usuarios/${id}/suscripciones`), dto).subscribe({
      next: (usuario) => {
        this.status.set({ type: 'ok', text: 'Suscripciones actualizadas' });
        this.usuarios.update((lista) => lista.map((u) => (u._id === usuario._id ? usuario : u)));
      },
      error: (err) => this.setError(err),
    });
  }

  actualizarPermisos(id: string, permisos: PermisosUsuario): void {
    this.http.patch<Usuario>(this.api.url(`/usuarios/${id}/permisos`), { permisos }).subscribe({
      next: (usuario) => {
        this.status.set({ type: 'ok', text: 'Permisos actualizados' });
        this.usuarios.update((lista) => lista.map((u) => (u._id === usuario._id ? usuario : u)));
      },
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
    // Cargar centros asignados directamente desde el documento del usuario
    const centros = (usuario.centros_asignados ?? []).map(id => asId(id)).filter(Boolean);
    this.centrosSeleccionados.set(centros);
    this.clearStatus();
  }

  toggleCentro(centroId: string, checked: boolean): void {
    const set = new Set(this.centrosSeleccionados());
    checked ? set.add(centroId) : set.delete(centroId);
    this.centrosSeleccionados.set(Array.from(set));
  }

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    const msg = err?.error?.message;
    this.status.set({ type: 'error', text: Array.isArray(msg) ? msg.join('. ') : (msg ?? 'Error inesperado') });
  }
}
