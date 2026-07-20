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
  // adjunto viene del backend como { tipo_mime, nombre } (sin contenido)
  adjunto?: { tipo_mime: string; nombre: string; tipo_contenido?: 'archivo' | 'link'; link_url?: string; subido_por_nombre?: string };
  // archivo_url/tipo_contenido/link_url/subido_por_nombre se computan en el service para compatibilidad con templates
  archivo_url?: string;
  archivo_nombre?: string;
  tipo_contenido?: 'archivo' | 'link';
  link_url?: string;
  subido_por_nombre?: string;
  creado_en: string;
  // Se actualiza en cada cambio de estado (aprobar/rechazar/adjuntar) — el backend
  // lo mantiene automáticamente vía timestamps de Mongoose.
  actualizado_en: string;
}

export interface NotificacionOpciones {
  notificar: boolean;
  audiencia?: 'todos' | 'especificos';
  destinatarios_ids?: string[];
  notificar_super_admins?: boolean;
}

export interface CreateSolicitudDto {
  nombre: string;
  tipo: CategoriaDocumento;
  descripcion?: string;
  empresa_id: string;
  centro_costo_id?: string;
  proyecto_id?: string;
  notificacion?: NotificacionOpciones;
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

  readonly solicitudes       = signal<Solicitud[]>([]);
  readonly loading           = signal(false);
  readonly status            = signal<SolicitudStatus | null>(null);

  clearStatus(): void { this.status.set(null); }

  private computarAdjuntoUrl(s: Solicitud): Solicitud {
    if (s.adjunto) {
      return {
        ...s,
        archivo_url: this.api.url(`/empresas/${s.empresa_id}/solicitudes/${s._id}/adjunto`),
        archivo_nombre: s.adjunto.nombre,
        tipo_contenido: s.adjunto.tipo_contenido,
        link_url: s.adjunto.link_url,
        subido_por_nombre: s.adjunto.subido_por_nombre,
      };
    }
    return s;
  }

  private getEmpresaId(id: string): string | undefined {
    return this.solicitudes().find(s => s._id === id)?.empresa_id;
  }

  cargar(empresaId: string, centroId?: string, proyectoId?: string): void {
    if (!empresaId) { this.solicitudes.set([]); return; }
    this.loading.set(true);
    const params: Record<string, string> = {};
    if (centroId)   params['centroId']   = centroId;
    if (proyectoId) params['proyectoId'] = proyectoId;
    const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
    this.http.get<Solicitud[] | { data: Solicitud[] }>(`${this.api.url(`/empresas/${empresaId}/solicitudes`)}${qs}`).subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : res.data;
        this.solicitudes.set(data.map(s => this.computarAdjuntoUrl(s)));
        this.loading.set(false);
      },
      error: () => { this.solicitudes.set([]); this.loading.set(false); },
    });
  }

  crear(dto: CreateSolicitudDto, onSuccess?: () => void): void {
    const { empresa_id, ...body } = dto;
    this.http.post<Solicitud>(this.api.url(`/empresas/${empresa_id}/solicitudes`), body).subscribe({
      next: (nueva) => {
        this.solicitudes.update(prev => [this.computarAdjuntoUrl(nueva), ...prev]);
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
    const empresaId = this.getEmpresaId(id);
    if (!empresaId) return;
    this.http.patch<Solicitud>(this.api.url(`/empresas/${empresaId}/solicitudes/${id}`), dto).subscribe({
      next: (actualizada) => {
        this.solicitudes.update(prev => prev.map(s => s._id === id ? this.computarAdjuntoUrl(actualizada) : s));
        this.status.set({ type: 'ok', text: 'Solicitud actualizada.' });
      },
      error: (err) => {
        const msg = err.error?.message ?? 'Error al actualizar la solicitud.';
        this.status.set({ type: 'error', text: Array.isArray(msg) ? msg.join(', ') : msg });
      },
    });
  }

  eliminarSolicitud(id: string): void {
    const empresaId = this.getEmpresaId(id);
    if (!empresaId) return;
    this.http.delete(this.api.url(`/empresas/${empresaId}/solicitudes/${id}`)).subscribe({
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

  adjuntar(id: string, archivo: File, onSuccess?: () => void, onError?: () => void): void {
    const empresaId = this.getEmpresaId(id);
    if (!empresaId) return;
    const form = new FormData();
    form.append('archivo', archivo);
    this.http.post<Solicitud>(this.api.url(`/empresas/${empresaId}/solicitudes/${id}/adjuntar`), form).subscribe({
      next: (actualizada) => {
        this.solicitudes.update(prev => prev.map(s => s._id === id ? this.computarAdjuntoUrl(actualizada) : s));
        this.status.set({ type: 'ok', text: 'Archivo adjuntado. Estado actualizado a "En revisión".' });
        onSuccess?.();
      },
      error: (err) => {
        if (err.status === 413) {
          this.status.set({ type: 'error', text: 'El archivo supera el límite de 20MB.' });
        } else {
          const msg = err.error?.message ?? 'Error al adjuntar el archivo.';
          this.status.set({ type: 'error', text: Array.isArray(msg) ? msg.join(', ') : msg });
        }
        onError?.();
      },
    });
  }

  adjuntarLink(id: string, linkUrl: string, onSuccess?: () => void, onError?: () => void): void {
    const empresaId = this.getEmpresaId(id);
    if (!empresaId) return;
    const form = new FormData();
    form.append('link_url', linkUrl);
    this.http.post<Solicitud>(this.api.url(`/empresas/${empresaId}/solicitudes/${id}/adjuntar`), form).subscribe({
      next: (actualizada) => {
        this.solicitudes.update(prev => prev.map(s => s._id === id ? this.computarAdjuntoUrl(actualizada) : s));
        this.status.set({ type: 'ok', text: 'Link adjuntado. Estado actualizado a "En revisión".' });
        onSuccess?.();
      },
      error: (err) => {
        const msg = err.error?.message ?? 'Error al adjuntar el link.';
        this.status.set({ type: 'error', text: Array.isArray(msg) ? msg.join(', ') : msg });
        onError?.();
      },
    });
  }

  cambiarEstado(id: string, estado: EstadoSolicitud, motivoRechazo?: string, notificacion?: NotificacionOpciones, onSuccess?: () => void): void {
    const empresaId = this.getEmpresaId(id);
    if (!empresaId) return;
    const body: Record<string, unknown> = { estado };
    if (estado === 'rechazado' && motivoRechazo) body['motivo_rechazo'] = motivoRechazo;
    if (notificacion) body['notificacion'] = notificacion;
    this.http.put<Solicitud>(this.api.url(`/empresas/${empresaId}/solicitudes/${id}/estado`), body).subscribe({
      next: (actualizada) => {
        this.solicitudes.update(prev => prev.map(s => s._id === id ? this.computarAdjuntoUrl(actualizada) : s));
        this.status.set({ type: 'ok', text: `Estado actualizado a "${this.estadoLabel(estado)}".` });
        onSuccess?.();
      },
      error: (err) => {
        const msg = err.error?.message ?? 'Error al cambiar el estado.';
        this.status.set({ type: 'error', text: Array.isArray(msg) ? msg.join(', ') : msg });
      },
    });
  }

  // Compatible con los templates que llaman descargar(s.archivo_url)
  descargar(url: string, nombreDisplay?: string): void {
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = nombreDisplay || 'adjunto';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      },
      error: () => this.status.set({ type: 'error', text: 'Error al descargar el archivo.' }),
    });
  }

  private estadoLabel(estado: EstadoSolicitud): string {
    const map: Record<EstadoSolicitud, string> = {
      pendiente: 'Pendiente', revision: 'En revisión',
      aprobado: 'Aprobado',   rechazado: 'Rechazado',
      vencido:  'Vencido',
    };
    return map[estado];
  }
}
