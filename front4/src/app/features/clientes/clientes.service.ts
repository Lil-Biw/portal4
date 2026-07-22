import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Cliente, CreateClienteDto, UpdateClienteDto } from '../../shared/models/cliente.model';
import { Status } from '../../shared/models/status.model';
import { NOTIFY_COOLDOWN_MS } from '../../shared/utils';

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private statusTimer: ReturnType<typeof setTimeout> | null = null;

  readonly clientes = signal<Cliente[]>([]);
  readonly seleccionado = signal<Cliente | null>(null);
  readonly status = signal<Status | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);

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
    this.saving.set(true);
    this.http.post<Cliente>(this.api.url('/empresas'), dto).subscribe({
      next: (cliente) => {
        this.saving.set(false);
        if (logoFile) {
          this.subirLogo(cliente._id, logoFile,
            () => { this.setStatus({ type: 'ok', text: 'Empresa creada correctamente' }); this.cargar(); },
            (msg) => { this.setStatus({ type: 'error', text: `Empresa creada, pero no se pudo subir el logo: ${msg}` }); this.cargar(); },
          );
        } else {
          this.setStatus({ type: 'ok', text: 'Empresa creada correctamente' });
          this.cargar();
        }
      },
      error: (err) => { this.setError(err); this.saving.set(false); },
    });
  }

  actualizar(id: string, dto: UpdateClienteDto, logoFile?: File | null): void {
    this.saving.set(true);
    this.http.put<Cliente>(this.api.url(`/empresas/${id}`), dto).subscribe({
      next: () => {
        this.saving.set(false);
        if (logoFile) {
          this.subirLogo(id, logoFile,
            () => { this.setStatus({ type: 'ok', text: 'Empresa actualizada' }); this.seleccionado.set(null); this.cargar(); },
            // Deja el modal abierto (seleccionado sin limpiar) para que el status de error
            // sea visible ahí y el admin pueda reintentar el logo sin recargar todo el form.
            (msg) => { this.setStatus({ type: 'error', text: `Empresa actualizada, pero no se pudo subir el logo: ${msg}` }); this.cargar(); },
          );
        } else {
          this.setStatus({ type: 'ok', text: 'Empresa actualizada' });
          this.seleccionado.set(null);
          this.cargar();
        }
      },
      error: (err) => { this.setError(err); this.saving.set(false); },
    });
  }

  subirLogo(id: string, file: File, onSuccess?: () => void, onError?: (msg: string) => void): void {
    const form = new FormData();
    form.append('archivo', file);
    this.http.post<Cliente>(this.api.url(`/empresas/${id}/logo`), form).subscribe({
      next: () => { if (onSuccess) onSuccess(); else this.cargar(); },
      error: (err) => {
        const raw = err?.error?.message ?? 'Error al subir el logo';
        const msg = Array.isArray(raw) ? raw.join(', ') : raw;
        if (onError) onError(msg);
        else this.setStatus({ type: 'error', text: msg });
      },
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/empresas/${id}`)).subscribe({
      next: () => {
        this.setStatus({ type: 'ok', text: 'Empresa eliminada' });
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
        this.setStatus({ type: 'ok', text: 'Score actualizado' });
        if (onComplete) onComplete(true);
      },
      error: (err) => { this.setError(err); if (onComplete) onComplete(false); },
    });
  }

  updateConfigGrafico(id: string, mostrarPromedio: boolean, onDone?: () => void): void {
    this.http.patch<Cliente>(this.api.url(`/empresas/${id}/config-grafico`), { mostrar_grafico_promedio: mostrarPromedio })
      .subscribe({
        next: empresa => {
          this.clientes.update(list => list.map(c => c._id === id ? { ...c, mostrar_grafico_promedio: empresa.mostrar_grafico_promedio } : c));
          onDone?.();
        },
        error: err => { this.setError(err); onDone?.(); },
      });
  }

  buscarPorId(id: string): void {
    this.http.get<Cliente>(this.api.url(`/empresas/${id}`)).subscribe({
      next: (res) => {
        this.seleccionado.set(res);
        this.setStatus({ type: 'ok', text: 'Empresa encontrada' });
      },
      error: (err) => this.setError(err),
    });
  }

  seleccionar(cliente: Cliente): void {
    this.seleccionado.set(cliente);
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
