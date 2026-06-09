import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Cliente, CreateClienteDto, UpdateClienteDto } from '../../shared/models/cliente.model';
import { Status } from '../../shared/models/status.model';

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);

  readonly clientes = signal<Cliente[]>([]);
  readonly seleccionado = signal<Cliente | null>(null);
  readonly status = signal<Status | null>(null);
  readonly loading = signal(false);

  cargar(): void {
    this.loading.set(true);
    this.http.get<{ data: Cliente[] } | Cliente[]>(this.api.url('/empresas')).subscribe({
      next: (res) => {
        this.clientes.set(Array.isArray(res) ? res : res.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.setError(err);
        this.loading.set(false);
      },
    });
  }

  crear(dto: CreateClienteDto, logoFile?: File | null): void {
    this.http.post<Cliente>(this.api.url('/empresas'), dto).subscribe({
      next: (cliente) => {
        this.status.set({ type: 'ok', text: 'Empresa creada correctamente' });
        if (logoFile) {
          this.subirLogo(cliente._id, logoFile, () => this.cargar());
        } else {
          this.cargar();
        }
      },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateClienteDto, logoFile?: File | null): void {
    this.http.put<Cliente>(this.api.url(`/empresas/${id}`), dto).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Empresa actualizada' });
        this.seleccionado.set(null);
        if (logoFile) {
          this.subirLogo(id, logoFile, () => this.cargar());
        } else {
          this.cargar();
        }
      },
      error: (err) => this.setError(err),
    });
  }

  subirLogo(id: string, file: File, onComplete?: () => void): void {
    const form = new FormData();
    form.append('archivo', file);
    this.http.post<Cliente>(this.api.url(`/empresas/${id}/logo`), form).subscribe({
      next: () => { if (onComplete) onComplete(); else this.cargar(); },
      error: () => { if (onComplete) onComplete(); },
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/empresas/${id}`)).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Empresa eliminada' });
        this.seleccionado.set(null);
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  updateScoreSmartclarity(id: string, valores: number[], onComplete?: (ok: boolean) => void): void {
    this.http.put<Cliente>(
      this.api.url(`/empresas/${id}/score-smartclarity`),
      { valores }
    ).subscribe({
      next: (empresa) => {
        this.clientes.update(list => list.map(c => c._id === id ? { ...c, score_smartclarity: empresa.score_smartclarity } : c));
        this.status.set({ type: 'ok', text: 'Score actualizado' });
        if (onComplete) onComplete(true);
      },
      error: (err) => { this.setError(err); if (onComplete) onComplete(false); },
    });
  }

  buscarPorId(id: string): void {
    this.http.get<Cliente>(this.api.url(`/empresas/${id}`)).subscribe({
      next: (res) => {
        this.seleccionado.set(res);
        this.status.set({ type: 'ok', text: 'Empresa encontrada' });
      },
      error: (err) => this.setError(err),
    });
  }

  seleccionar(cliente: Cliente): void {
    this.seleccionado.set(cliente);
    this.clearStatus();
  }

  clearStatus(): void {
    this.status.set(null);
  }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }
}
