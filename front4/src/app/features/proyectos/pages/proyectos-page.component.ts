import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProyectosService } from '../proyectos.service';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { ProyectoFormComponent } from '../components/proyecto-form/proyecto-form.component';
import { ProyectosListComponent } from '../components/proyectos-list/proyectos-list.component';
import { Proyecto, CreateProyectoDto } from '../../../shared/models/proyecto.model';
import { asId } from '../../../shared/utils';
import { AuthService } from '../../auth/auth.service';

type ModalMode = 'crear' | 'editar' | 'buscar' | null;

@Component({
  selector: 'app-proyectos-page',
  standalone: true,
  imports: [NgIf, FormsModule, StatusBannerComponent, ProyectoFormComponent, ProyectosListComponent],
  templateUrl: './proyectos-page.component.html',
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
      max-width: 680px;
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
export class ProyectosPageComponent implements OnInit {
  protected readonly service         = inject(ProyectosService);
  protected readonly clientesService  = inject(ClientesService);
  protected readonly centrosService   = inject(CentrosService);
  private readonly authService        = inject(AuthService);

  protected modal    = signal<ModalMode>(null);
  protected busqueda = signal('');

  protected proyectosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.service.proyectos();
    return this.service.proyectos().filter(p => {
      const empresa = this.clientesService.clientes()
        .find(x => asId(x._id) === asId(p.cliente_id))?.razon_social ?? '';
      const centro = this.centrosService.centros()
        .find(x => asId(x._id) === asId(p.centro_costo_id))?.nombre ?? '';
      return p.nombre.toLowerCase().includes(q) ||
             p.codigo.toLowerCase().includes(q) ||
             empresa.toLowerCase().includes(q)  ||
             centro.toLowerCase().includes(q);
    });
  });

  ngOnInit(): void {
    this.service.cargar();
    this.centrosService.cargar();
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

  protected abrirEditar(proyecto: Proyecto): void {
    this.service.seleccionar(proyecto);
    this.modal.set('editar');
  }

  protected cerrar(): void {
    this.modal.set(null);
    this.service.seleccionado.set(null);
    this.service.clearStatus();
  }

  protected crear(dto: CreateProyectoDto): void   { this.service.crear(dto); }

  protected actualizar(dto: CreateProyectoDto): void {
    const id = this.service.seleccionado()?._id;
    if (id) this.service.actualizar(id, dto);
  }

  protected eliminar(id: string): void {
    const proyecto = this.service.proyectos().find(p => p._id === id);
    if (proyecto) this.service.seleccionar(proyecto);
    this.service.eliminar(id);
  }

  protected editarDesdeBuscar(proyecto: Proyecto): void {
    this.service.seleccionar(proyecto);
    this.modal.set('editar');
  }
}
