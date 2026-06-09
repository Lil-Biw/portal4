import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { CentroCosto, CreateCentroDto, UpdateCentroDto } from '../../shared/models/centro.model';
import { Status } from '../../shared/models/status.model';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class CentrosService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly centros = signal<CentroCosto[]>([]);
  readonly seleccionado = signal<CentroCosto | null>(null);
  readonly status = signal<Status | null>(null);
  readonly loading = signal(false);

  // Admin: carga todos los centros
  cargar(): void {
    this.loading.set(true);
    this.http.get<{ data: CentroCosto[] } | CentroCosto[]>(this.api.url('/centros-costos')).subscribe({
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
      this.api.url(`/empresas/${empresaId}/centros`)
    ).subscribe({
      next: (res) => {
        this.centros.set(Array.isArray(res) ? res : res.data);
        this.loading.set(false);
      },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  crear(dto: CreateCentroDto): void {
    const { cliente_id, ...body } = dto;
    if (!cliente_id) {
      this.status.set({ type: 'error', text: 'Debes seleccionar una empresa.' });
      return;
    }
    this.http.post<CentroCosto>(this.api.url(`/empresas/${cliente_id}/centros`), body).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Centro creado correctamente' }); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateCentroDto): void {
    const empresaId = dto.cliente_id ?? this.seleccionado()?.cliente_id;
    if (!empresaId) { this.setError({ error: { message: 'No se pudo determinar la empresa del centro' } }); return; }
    const { cliente_id, ...body } = dto as CreateCentroDto;
    this.http.put<CentroCosto>(this.api.url(`/empresas/${empresaId}/centros/${id}`), body).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Centro actualizado' });
        this.seleccionado.set(null);
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  eliminar(id: string): void {
    const empresaId = this.seleccionado()?.cliente_id;
    if (!empresaId) { this.setError({ error: { message: 'No se pudo determinar la empresa del centro' } }); return; }
    this.http.delete(this.api.url(`/empresas/${empresaId}/centros/${id}`)).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Centro eliminado' });
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

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }
}
