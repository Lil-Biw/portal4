import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Actividad, CreateActividadDto, DocActividad, UpdateActividadDto } from '../../shared/models/actividad.model';
import { Status } from '../../shared/models/status.model';
import { CentrosService } from '../centros/centros.service';
import { AuthService } from '../auth/auth.service';
import { asId } from '../../shared/utils';

@Injectable({ providedIn: 'root' })
export class ActividadesService {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);
  private readonly centrosService = inject(CentrosService);
  private readonly auth = inject(AuthService);

  readonly actividades         = signal<Actividad[]>([]);
  readonly loading             = signal(false);
  readonly saving              = signal(false);
  readonly status              = signal<Status | null>(null);
  readonly documentosActividad = signal<DocActividad[]>([]);

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

  listarDocumentos(actividadId: string): void {
    const actividad = this.actividades().find(a => a._id === actividadId);
    if (!actividad) { this.documentosActividad.set([]); return; }
    const centroId = asId(actividad.centro_costo_id);
    const empresaId = this.getEmpresaId(centroId);
    if (!empresaId) { this.documentosActividad.set([]); return; }
    this.http.get<DocActividad[]>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/actividades/${actividadId}/documentos`)
    ).subscribe({
      next: (docs) => this.documentosActividad.set(docs),
      error: () => this.documentosActividad.set([]),
    });
  }

  subirDocumento(id: string, archivo: File, nombreDisplay?: string, onSuccess?: () => void, onError?: () => void): void {
    if (this.saving()) return;
    const centroId = this.actividades().find(a => a._id === id)?.centro_costo_id;
    const empresaId = centroId ? this.getEmpresaId(centroId) : undefined;
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.saving.set(true);
    const form = new FormData();
    form.append('archivo', archivo);
    if (nombreDisplay) form.append('nombre_display', nombreDisplay);
    this.http.post(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/actividades/${id}/documentos`),
      form
    ).subscribe({
      next: () => {
        this.saving.set(false);
        this.status.set({ type: 'ok', text: 'Documento adjuntado correctamente' });
        this.listarDocumentos(id);
        onSuccess?.();
      },
      error: err => { this.setError(err); onError?.(); },
    });
  }

  subirDocumentoLink(id: string, linkUrl: string, nombreDisplay?: string, onSuccess?: () => void, onError?: () => void): void {
    if (this.saving()) return;
    const centroId = this.actividades().find(a => a._id === id)?.centro_costo_id;
    const empresaId = centroId ? this.getEmpresaId(centroId) : undefined;
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.saving.set(true);
    const form = new FormData();
    form.append('link_url', linkUrl);
    if (nombreDisplay) form.append('nombre_display', nombreDisplay);
    this.http.post(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/actividades/${id}/documentos`),
      form
    ).subscribe({
      next: () => {
        this.saving.set(false);
        this.status.set({ type: 'ok', text: 'Documento adjuntado correctamente' });
        this.listarDocumentos(id);
        onSuccess?.();
      },
      error: err => { this.setError(err); onError?.(); },
    });
  }

  eliminarDocumento(actividadId: string, docId: string): void {
    const centroId = this.actividades().find(a => a._id === actividadId)?.centro_costo_id;
    const empresaId = centroId ? this.getEmpresaId(centroId) : undefined;
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.delete(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/actividades/${actividadId}/documentos/${docId}`)
    ).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Documento eliminado' });
        this.listarDocumentos(actividadId);
      },
      error: err => this.setError(err),
    });
  }

  descargarDocumento(actividadId: string, docId: string, nombreDisplay?: string): void {
    const centroId = this.actividades().find(a => a._id === actividadId)?.centro_costo_id;
    const empresaId = centroId ? this.getEmpresaId(centroId) : undefined;
    if (!empresaId || !centroId) { this.status.set({ type: 'error', text: 'Centro no encontrado' }); return; }
    const url = this.api.url(
      `/empresas/${empresaId}/centros/${centroId}/actividades/${actividadId}/documentos/${docId}`
    );
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = nombreDisplay || docId;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      },
      error: () => this.status.set({ type: 'error', text: 'Error al descargar el documento' }),
    });
  }
}
