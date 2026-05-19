import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CentrosService } from '../centros.service';
import { ClientesService } from '../../clientes/clientes.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { CentroFormComponent } from '../components/centro-form/centro-form.component';
import { CentrosListComponent } from '../components/centros-list/centros-list.component';
import { CentroCosto, CreateCentroDto } from '../../../shared/models/centro.model';
import { asId } from '../../../shared/utils';
import { ProfileService } from '../../../profile/profile.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';

type ModalMode = 'crear' | 'editar' | 'buscar' | null;

@Component({
  selector: 'app-centros-page',
  standalone: true,
  imports: [NgIf, FormsModule, StatusBannerComponent, CentroFormComponent, CentrosListComponent],
  templateUrl: './centros-page.component.html',
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .page-header h2 { margin: 0; font-size: 1.25rem; font-weight: 700; color: #1f2937; }
    .header-actions { display: flex; gap: .6rem; }

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
export class CentrosPageComponent implements OnInit {
  protected readonly service          = inject(CentrosService);
  protected readonly clientesService  = inject(ClientesService);
  private   readonly profileService   = inject(ProfileService);
  private   readonly consumidorContext = inject(ConsumidorContextService);
  private   readonly router           = inject(Router);

  protected modal    = signal<ModalMode>(null);
  protected busqueda = signal('');

  protected centrosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.service.centros();
    return this.service.centros().filter(c => {
      const empresa = this.clientesService.clientes()
        .find(x => asId(x._id) === asId(c.cliente_id))?.razon_social ?? '';
      return c.nombre.toLowerCase().includes(q) ||
             c.codigo.toLowerCase().includes(q) ||
             empresa.toLowerCase().includes(q);
    });
  });

  ngOnInit(): void {
    this.service.cargar();
    this.clientesService.cargar();
  }

  protected abrirCrear(): void {
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.modal.set('crear');
  }

  protected abrirBuscar(): void {
    this.busqueda.set('');
    this.service.clearStatus();
    this.modal.set('buscar');
  }

  protected abrirEditar(centro: CentroCosto): void {
    this.service.seleccionar(centro);
    this.modal.set('editar');
  }

  protected cerrar(): void {
    this.modal.set(null);
    this.service.seleccionado.set(null);
    this.service.clearStatus();
  }

  protected crear(dto: CreateCentroDto): void   { this.service.crear(dto); }

  protected actualizar(dto: CreateCentroDto): void {
    const id = this.service.seleccionado()?._id;
    if (id) this.service.actualizar(id, dto);
  }

  protected eliminar(id: string): void { this.service.eliminar(id); }

  protected irACentro(centro: CentroCosto): void {
    const empresa = this.clientesService.clientes()
      .find(c => asId(c._id) === asId(centro.cliente_id));
    if (!empresa) return; // no navegar si la empresa no está cargada
    this.consumidorContext.seleccionar(empresa);
    this.consumidorContext.seleccionarCentro(centro);
    this.profileService.setMode('consumidor');
    this.router.navigate(['/mis-centros']);
  }

  protected editarDesdeBuscar(centro: CentroCosto): void {
    this.service.seleccionar(centro);
    this.modal.set('editar');
  }
}
