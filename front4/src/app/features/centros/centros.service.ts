import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { CentroCosto, CreateCentroDto, UpdateCentroDto } from '../../shared/models/centro.model';
import { Status } from '../../shared/models/status.model';
import { AuthService } from '../auth/auth.service';
import { NOTIFY_COOLDOWN_MS } from '../../shared/utils';

@Injectable({ providedIn: 'root' })
export class CentrosService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private statusTimer: ReturnType<typeof setTimeout> | null = null;

  readonly centros = signal<CentroCosto[]>([]);
  readonly seleccionado = signal<CentroCosto | null>(null);
  readonly status = signal<Status | null>(null);
  readonly loading = signal(false);

  // Admin: carga todos los centros
  cargar(): void {
    this.loading.set(true);
    this.http.get<{ data: CentroCosto[] } | CentroCosto[]>(this.api.url('/centros-costos?limit=200')).subscribe({
      next: (res) => {
        this.centros.set(Array.isArray(res) ? res : res.data);
        this.loading.set(false);
      },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  // Consumidor: carga centros de una empresa específica
  cargarPorEmpresa(empresaId: string): void {
    this.loading.set(true);
    this.http.get<{ data: CentroCosto[] } | CentroCosto[]>(
      this.api.url(`/empresas/${empresaId}/centros?limit=200`)
    ).subscribe({
      next: (res) => {
        this.centros.set(Array.isArray(res) ? res : res.data);
        this.loading.set(false);
      },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  crear(dto: CreateCentroDto, fotoFile?: File | null): void {
    const { cliente_id, ...body } = dto;
    if (!cliente_id) {
      this.setStatus({ type: 'error', text: 'Debes seleccionar una empresa.' });
      return;
    }
    this.http.post<CentroCosto>(this.api.url(`/empresas/${cliente_id}/centros`), body).subscribe({
      next: (centro) => {
        if (fotoFile) {
          this.subirFoto(cliente_id, centro._id, fotoFile,
            () => { this.setStatus({ type: 'ok', text: 'Centro creado correctamente' }); this.cargar(); },
            (msg) => { this.setStatus({ type: 'error', text: `Centro creado, pero no se pudo subir la foto: ${msg}` }); this.cargar(); },
          );
        } else {
          this.setStatus({ type: 'ok', text: 'Centro creado correctamente' });
          this.cargar();
        }
      },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateCentroDto, fotoFile?: File | null): void {
    const empresaId = dto.cliente_id ?? this.seleccionado()?.cliente_id;
    if (!empresaId) { this.setError({ error: { message: 'No se pudo determinar la empresa del centro' } }); return; }
    const { cliente_id, ...body } = dto as CreateCentroDto;
    this.http.put<CentroCosto>(this.api.url(`/empresas/${empresaId}/centros/${id}`), body).subscribe({
      next: () => {
        if (fotoFile) {
          this.subirFoto(String(empresaId), id, fotoFile,
            () => { this.setStatus({ type: 'ok', text: 'Centro actualizado' }); this.seleccionado.set(null); this.cargar(); },
            (msg) => { this.setStatus({ type: 'error', text: `Centro actualizado, pero no se pudo subir la foto: ${msg}` }); this.cargar(); },
          );
        } else {
          this.setStatus({ type: 'ok', text: 'Centro actualizado' });
          this.seleccionado.set(null);
          this.cargar();
        }
      },
      error: (err) => this.setError(err),
    });
  }

  subirFoto(empresaId: string, centroId: string, file: File, onSuccess?: () => void, onError?: (msg: string) => void): void {
    const form = new FormData();
    form.append('archivo', file);
    this.http.post<CentroCosto>(this.api.url(`/empresas/${empresaId}/centros/${centroId}/foto`), form).subscribe({
      next: () => { if (onSuccess) onSuccess(); else this.cargar(); },
      error: (err) => {
        const raw = err?.error?.message ?? 'Error al subir la foto';
        const msg = Array.isArray(raw) ? raw.join(', ') : raw;
        if (onError) onError(msg);
        else this.setStatus({ type: 'error', text: msg });
      },
    });
  }

  eliminar(id: string): void {
    const empresaId = this.seleccionado()?.cliente_id;
    if (!empresaId) { this.setError({ error: { message: 'No se pudo determinar la empresa del centro' } }); return; }
    this.http.delete(this.api.url(`/empresas/${empresaId}/centros/${id}`)).subscribe({
      next: () => {
        this.setStatus({ type: 'ok', text: 'Centro eliminado' });
        this.seleccionado.set(null);
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  updateScoreSmartclarity(empresaId: string, centroId: string, valores: number[], onComplete?: (ok: boolean) => void): void {
    this.http.put<CentroCosto>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/score-smartclarity`),
      { valores }
    ).subscribe({
      next: (centro) => {
        this.centros.update(list => list.map(c => c._id === centroId ? { ...c, score_smartclarity: centro.score_smartclarity } : c));
        if (onComplete) onComplete(true);
      },
      error: (err) => { this.setError(err); if (onComplete) onComplete(false); },
    });
  }

  seleccionar(centro: CentroCosto): void {
    this.seleccionado.set(centro);
    this.clearStatus();
  }

  clearStatus(): void {
    if (this.statusTimer) { clearTimeout(this.statusTimer); this.statusTimer = null; }
    this.status.set(null);
  }

  private setStatus(status: Status): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.status.set(status);
    this.statusTimer = setTimeout(() => { this.status.set(null); this.statusTimer = null; }, NOTIFY_COOLDOWN_MS);
  }

  private setError(err: { error?: { message?: string } }): void {
    this.setStatus({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }
}
