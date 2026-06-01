import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { CategoriaDocumento } from '../documentos/documentos.service';

export type EstadoSolicitud = 'pendiente' | 'revision' | 'aprobado' | 'rechazado' | 'vencido';

export interface Solicitud {
  _id: string;
  nombre: string;
  tipo: CategoriaDocumento;
  descripcion?: string;
  empresa_id: string;
  centro_costo_id?: string;
  proyecto_id?: string;
  estado: EstadoSolicitud;
  motivo_rechazo?: string;
  archivo_nombre?: string;
  archivo_url?: string;
  creado_en: string;
}

export interface CreateSolicitudDto {
  nombre: string;
  tipo: CategoriaDocumento;
  descripcion?: string;
  empresa_id: string;
  centro_costo_id?: string;
  proyecto_id?: string;
}

export interface UpdateSolicitudDto {
  nombre?: string;
  tipo?: CategoriaDocumento;
  descripcion?: string;
}

export interface SolicitudStatus {
  type: 'ok' | 'error';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class SolicitudesService {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);

  readonly solicitudes = signal<Solicitud[]>([]);
  readonly loading     = signal(false);
  readonly status      = signal<SolicitudStatus | null>(null);

  clearStatus(): void { this.status.set(null); }

  cargar(empresaId: string, centroId?: string, proyectoId?: string): void {
    if (!empresaId) { this.solicitudes.set([]); return; }
    this.loading.set(true);
    const params: Record<string, string> = { empresa_id: empresaId };
    if (centroId)   params['centro_costo_id'] = centroId;
    if (proyectoId) params['proyecto_id'] = proyectoId;
    const qs = new URLSearchParams(params).toString();
    this.http.get<Solicitud[]>(`${this.api.url('/solicitudes')}?${qs}`).subscribe({
      next: (data) => { this.solicitudes.set(data); this.loading.set(false); },
      error: ()     => { this.solicitudes.set([]); this.loading.set(false); },
    });
  }

  crear(dto: CreateSolicitudDto, onSuccess?: () => void): void {
    this.http.post<Solicitud>(this.api.url('/solicitudes'), dto).subscribe({
      next: (nueva) => {
        this.solicitudes.update(prev => [nueva, ...prev]);
        this.status.set({ type: 'ok', text: 'Solicitud creada correctamente.' });
        onSuccess?.();
      },
      error: (err) => {
        const msg = err.error?.message ?? 'Error al crear la solicitud.';
        this.status.set({ type: 'error', text: Array.isArray(msg) ? msg.join(', ') : msg });
      },
    });
  }

  actualizar(id: string, dto: UpdateSolicitudDto): void {
    this.http.patch<Solicitud>(this.api.url(`/solicitudes/${id}`), dto).subscribe({
      next: (actualizada) => {
        this.solicitudes.update(prev => prev.map(s => s._id === id ? actualizada : s));
        this.status.set({ type: 'ok', text: 'Solicitud actualizada.' });
      },
      error: (err) => {
        const msg = err.error?.message ?? 'Error al actualizar la solicitud.';
        this.status.set({ type: 'error', text: Array.isArray(msg) ? msg.join(', ') : msg });
      },
    });
  }

  eliminarSolicitud(id: string): void {
    this.http.delete(this.api.url(`/solicitudes/${id}`)).subscribe({
      next: () => {
        this.solicitudes.update(prev => prev.filter(s => s._id !== id));
        this.status.set({ type: 'ok', text: 'Solicitud eliminada.' });
      },
      error: (err) => {
        const msg = err.error?.message ?? 'Error al eliminar la solicitud.';
        this.status.set({ type: 'error', text: Array.isArray(msg) ? msg.join(', ') : msg });
      },
    });
  }

  adjuntar(id: string, archivo: File, onSuccess?: () => void): void {
    const form = new FormData();
    form.append('archivo', archivo);
    this.http.post<Solicitud>(this.api.url(`/solicitudes/${id}/adjuntar`), form).subscribe({
      next: (actualizada) => {
        this.solicitudes.update(prev => prev.map(s => s._id === id ? actualizada : s));
        this.status.set({ type: 'ok', text: 'Archivo adjuntado. Estado actualizado a "En revisión".' });
        onSuccess?.();
      },
      error: (err) => {
        const msg = err.error?.message ?? 'Error al adjuntar el archivo.';
        this.status.set({ type: 'error', text: Array.isArray(msg) ? msg.join(', ') : msg });
      },
    });
  }

  cambiarEstado(id: string, estado: EstadoSolicitud, motivoRechazo?: string): void {
    const body: Record<string, string> = { estado };
    if (estado === 'rechazado' && motivoRechazo) body['motivo_rechazo'] = motivoRechazo;
    this.http.put<Solicitud>(this.api.url(`/solicitudes/${id}/estado`), body).subscribe({
      next: (actualizada) => {
        this.solicitudes.update(prev => prev.map(s => s._id === id ? actualizada : s));
        this.status.set({ type: 'ok', text: `Estado actualizado a "${this.estadoLabel(estado)}".` });
      },
      error: (err) => {
        const msg = err.error?.message ?? 'Error al cambiar el estado.';
        this.status.set({ type: 'error', text: Array.isArray(msg) ? msg.join(', ') : msg });
      },
    });
  }

  descargar(url: string): void {
    const fullUrl = url.startsWith('http') ? url : `${new URL(this.api.base).origin}${url}`;
    window.open(fullUrl, '_blank');
  }

  private estadoLabel(estado: EstadoSolicitud): string {
    const map: Record<EstadoSolicitud, string> = {
      pendiente: 'Pendiente', revision: 'En revisión',
      aprobado: 'Aprobado',   rechazado: 'Rechazado',
      vencido: 'Vencido',
    };
    return map[estado];
  }
}
