import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Actividad, CreateActividadDto, UpdateActividadDto } from '../../shared/models/actividad.model';
import { Status } from '../../shared/models/status.model';
import { CentrosService } from '../centros/centros.service';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class ActividadesService {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);
  private readonly centrosService = inject(CentrosService);
  private readonly auth = inject(AuthService);

  readonly actividades = signal<Actividad[]>([]);
  readonly loading     = signal(false);
  readonly saving      = signal(false);
  readonly status      = signal<Status | null>(null);

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    this.saving.set(false);
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }

  private getEmpresaId(centroCostoId: string): string | undefined {
    return this.centrosService.centros().find(c => c._id === centroCostoId)?.cliente_id;
  }

  cargar(centroCostoId?: string): void {
    this.loading.set(true);
    const qs = centroCostoId ? `?centro_costo_id=${centroCostoId}` : '';
    this.http.get<Actividad[] | { data: Actividad[] }>(`${this.api.url('/actividades')}${qs}`).subscribe({
      next:  res => {
        this.actividades.set(Array.isArray(res) ? res : res.data);
        this.loading.set(false);
      },
      error: err  => { this.loading.set(false); this.setError(err); },
    });
  }

  cargarPorEmpresa(empresaId: string): void {
    this.loading.set(true);
    this.http.get<Actividad[]>(this.api.url(`/empresas/${empresaId}/actividades`)).subscribe({
      next:  res => { this.actividades.set(res); this.loading.set(false); },
      error: err => { this.loading.set(false); this.setError(err); },
    });
  }

  crear(dto: CreateActividadDto, onCreated?: (a: Actividad) => void): void {
    if (this.saving()) return;
    this.saving.set(true);
    const empresaId = this.getEmpresaId(dto.centro_costo_id);
    if (!empresaId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.post<Actividad>(
      this.api.url(`/empresas/${empresaId}/centros/${dto.centro_costo_id}/actividades`),
      dto
    ).subscribe({
      next: a => {
        this.saving.set(false);
        this.actividades.update(list => [...list, a].sort((x, y) => x.fecha.localeCompare(y.fecha)));
        this.status.set({ type: 'ok', text: 'Actividad creada correctamente' });
        onCreated?.(a);
      },
      error: err => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateActividadDto, onSuccess?: () => void): void {
    if (this.saving()) return;
    this.saving.set(true);
    const centroId = dto.centro_costo_id ?? this.actividades().find(a => a._id === id)?.centro_costo_id;
    const empresaId = centroId ? this.getEmpresaId(centroId) : undefined;
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.put<Actividad>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/actividades/${id}`),
      dto
    ).subscribe({
      next: updated => {
        this.saving.set(false);
        this.actividades.update(list =>
          list.map(a => a._id === id ? updated : a).sort((x, y) => x.fecha.localeCompare(y.fecha))
        );
        this.status.set({ type: 'ok', text: 'Actividad actualizada correctamente' });
        onSuccess?.();
      },
      error: err => this.setError(err),
    });
  }

  eliminar(id: string): void {
    const centroId = this.actividades().find(a => a._id === id)?.centro_costo_id;
    const empresaId = centroId ? this.getEmpresaId(centroId) : undefined;
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.delete(this.api.url(`/empresas/${empresaId}/centros/${centroId}/actividades/${id}`)).subscribe({
      next: () => {
        this.actividades.update(list => list.filter(a => a._id !== id));
        this.status.set({ type: 'ok', text: 'Actividad eliminada' });
      },
      error: err => this.setError(err),
    });
  }

  subirDocumento(id: string, archivo: File, nombreDisplay?: string, onSuccess?: () => void, onError?: () => void): void {
    const centroId = this.actividades().find(a => a._id === id)?.centro_costo_id;
    const empresaId = centroId ? this.getEmpresaId(centroId) : undefined;
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    const form = new FormData();
    form.append('archivo', archivo);
    if (nombreDisplay) form.append('nombre_display', nombreDisplay);
    this.http.post<Actividad>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/actividades/${id}/documentos`),
      form
    ).subscribe({
      next: updated => {
        this.actividades.update(list => list.map(a => a._id === id ? updated : a));
        this.status.set({ type: 'ok', text: 'Documento adjuntado correctamente' });
        onSuccess?.();
      },
      error: err => { this.setError(err); onError?.(); },
    });
  }

  eliminarDocumento(actividadId: string, nombreArchivo: string): void {
    const centroId = this.actividades().find(a => a._id === actividadId)?.centro_costo_id;
    const empresaId = centroId ? this.getEmpresaId(centroId) : undefined;
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    const encoded = encodeURIComponent(nombreArchivo);
    this.http.delete<Actividad>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/actividades/${actividadId}/documentos/${encoded}`)
    ).subscribe({
      next: updated => {
        this.actividades.update(list => list.map(a => a._id === actividadId ? updated : a));
        this.status.set({ type: 'ok', text: 'Documento eliminado' });
      },
      error: err => this.setError(err),
    });
  }

  descargarDocumento(actividadId: string, nombreArchivo: string, nombreDisplay?: string): void {
    const centroId = this.actividades().find(a => a._id === actividadId)?.centro_costo_id;
    const empresaId = centroId ? this.getEmpresaId(centroId) : undefined;
    if (!empresaId || !centroId) { this.status.set({ type: 'error', text: 'Centro no encontrado' }); return; }
    const url = this.api.url(
      `/empresas/${empresaId}/centros/${centroId}/actividades/${actividadId}/documentos/${encodeURIComponent(nombreArchivo)}`
    );
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
