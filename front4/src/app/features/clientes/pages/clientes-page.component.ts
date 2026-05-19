import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ClientesService } from '../clientes.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { ClienteFormComponent } from '../components/cliente-form/cliente-form.component';
import { ClientesListComponent } from '../components/clientes-list/clientes-list.component';
import { Cliente, CreateClienteDto } from '../../../shared/models/cliente.model';
import { ProfileService } from '../../../profile/profile.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';

type ModalMode = 'crear' | 'editar' | 'buscar' | null;

@Component({
  selector: 'app-clientes-page',
  standalone: true,
  imports: [NgIf, FormsModule, StatusBannerComponent, ClienteFormComponent, ClientesListComponent],
  templateUrl: './clientes-page.component.html',
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .page-header h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: #1f2937;
    }
    .header-actions { display: flex; gap: .6rem; }

    /* Modal overlay */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15,23,42,.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1rem;
    }
    .modal {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15,23,42,.18);
      width: 100%;
      max-width: 640px;
      max-height: 85vh;
      overflow-y: auto;
      padding: 1.5rem;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .modal-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .modal-close {
      background: none;
      border: none;
      font-size: 1.4rem;
      line-height: 1;
      cursor: pointer;
      color: #6b7280;
      padding: 0 .25rem;
    }
    .modal-close:hover { color: #1f2937; }

    /* Buscar */
    .search-input {
      width: 100%;
      padding: .65rem .9rem;
      border-radius: 8px;
      border: 1px solid rgba(34,33,33,.2);
      font-size: .9rem;
      font-family: inherit;
      margin-bottom: 1rem;
      box-sizing: border-box;
    }
    .search-input:focus { outline: none; border-color: #0095d6; }

  `],
})
export class ClientesPageComponent implements OnInit {
  protected readonly service              = inject(ClientesService);
  private  readonly profileService        = inject(ProfileService);
  private  readonly consumidorContext     = inject(ConsumidorContextService);
  private  readonly router                = inject(Router);

  protected modal = signal<ModalMode>(null);
  protected busqueda = signal('');
  protected pendingLogo = signal<File | null>(null);

  protected clientesFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.service.clientes();
    return this.service.clientes().filter(c =>
      c.razon_social.toLowerCase().includes(q) ||
      c.rut.toLowerCase().includes(q) ||
      c.email_contacto.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.service.cargar();
  }

  protected abrirCrear(): void {
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.pendingLogo.set(null);
    this.modal.set('crear');
  }

  protected abrirBuscar(): void {
    this.busqueda.set('');
    this.service.clearStatus();
    this.modal.set('buscar');
  }

  protected abrirEditar(cliente: Cliente): void {
    this.service.seleccionar(cliente);
    this.pendingLogo.set(null);
    this.modal.set('editar');
  }

  protected cerrar(): void {
    this.modal.set(null);
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.pendingLogo.set(null);
  }

  protected crear(dto: CreateClienteDto): void {
    this.service.crear(dto, this.pendingLogo());
    this.pendingLogo.set(null);
  }

  protected actualizar(dto: CreateClienteDto): void {
    const id = this.service.seleccionado()?._id;
    if (id) this.service.actualizar(id, dto, this.pendingLogo());
    this.pendingLogo.set(null);
  }

  protected eliminar(id: string): void {
    this.service.eliminar(id);
  }

  protected editarDesdeBuscar(cliente: Cliente): void {
    this.service.seleccionar(cliente);
    this.pendingLogo.set(null);
    this.modal.set('editar');
  }

  protected irAFicha(cliente: Cliente): void {
    this.consumidorContext.seleccionar(cliente);
    this.profileService.setMode('consumidor');
    this.router.navigate(['/inicio']);
  }

}
