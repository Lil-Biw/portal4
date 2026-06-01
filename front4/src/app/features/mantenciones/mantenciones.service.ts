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
  readonly saving       = signal(false);
  readonly status       = signal<Status | null>(null);

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    this.saving.set(false);
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

  crear(dto: CreateMantencionDto, onCreated?: (m: Mantencion) => void): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.http.post<Mantencion>(this.api.url('/mantenciones'), dto).subscribe({
      next: m => {
        this.saving.set(false);
        this.mantenciones.update(list => [...list, m].sort((a, b) => a.fecha.localeCompare(b.fecha)));
        this.status.set({ type: 'ok', text: 'Mantención creada correctamente' });
        onCreated?.(m);
      },
      error: err => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateMantencionDto, onSuccess?: () => void): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.http.put<Mantencion>(this.api.url(`/mantenciones/${id}`), dto).subscribe({
      next: updated => {
        this.saving.set(false);
        this.mantenciones.update(list =>
          list.map(m => m._id === id ? updated : m).sort((a, b) => a.fecha.localeCompare(b.fecha))
        );
        this.status.set({ type: 'ok', text: 'Mantención actualizada correctamente' });
        onSuccess?.();
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

  subirDocumento(id: string, archivo: File, nombreDisplay?: string, onSuccess?: () => void): void {
    const form = new FormData();
    form.append('archivo', archivo);
    if (nombreDisplay) form.append('nombre_display', nombreDisplay);
    this.http.post<Mantencion>(this.api.url(`/mantenciones/${id}/documentos`), form).subscribe({
      next: updated => {
        this.mantenciones.update(list => list.map(m => m._id === id ? updated : m));
        this.status.set({ type: 'ok', text: 'Documento adjuntado correctamente' });
        onSuccess?.();
      },
      error: err => this.setError(err),
    });
  }

  eliminarDocumento(mantencionId: string, nombreArchivo: string): void {
    const encoded = encodeURIComponent(nombreArchivo);
    this.http.delete<Mantencion>(this.api.url(`/mantenciones/${mantencionId}/documentos/${encoded}`)).subscribe({
      next: updated => {
        this.mantenciones.update(list => list.map(m => m._id === mantencionId ? updated : m));
        this.status.set({ type: 'ok', text: 'Documento eliminado' });
      },
      error: err => this.setError(err),
    });
  }

  descargarDocumento(mantencionId: string, nombreArchivo: string, nombreDisplay?: string): void {
    const url = this.api.url(`/mantenciones/${mantencionId}/documentos/${encodeURIComponent(nombreArchivo)}`);
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = nombreDisplay || nombreArchivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      },
      error: () => this.status.set({ type: 'error', text: 'Error al descargar el documento' }),
    });
  }

}
