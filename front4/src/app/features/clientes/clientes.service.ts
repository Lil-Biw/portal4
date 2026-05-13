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
    this.http.get<{ data: Cliente[] } | Cliente[]>(this.api.url('/clientes')).subscribe({
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

  crear(dto: CreateClienteDto): void {
    this.http.post<Cliente>(this.api.url('/clientes'), dto).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Empresa creada correctamente' });
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateClienteDto): void {
    this.http.put<Cliente>(this.api.url(`/clientes/${id}`), dto).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Empresa actualizada' });
        this.seleccionado.set(null);
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/clientes/${id}`)).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Empresa eliminada' });
        this.seleccionado.set(null);
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  buscarPorId(id: string): void {
    this.http.get<Cliente>(this.api.url(`/clientes/${id}`)).subscribe({
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
