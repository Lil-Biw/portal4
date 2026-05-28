import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuariosService } from '../usuarios.service';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { UsuarioFormComponent, UsuarioFormOutput } from '../components/usuario-form/usuario-form.component';
import { UsuariosListComponent } from '../components/usuarios-list/usuarios-list.component';
import { Usuario } from '../../../shared/models/usuario.model';
import { asId } from '../../../shared/utils';

type ModalMode = 'crear' | 'editar' | 'buscar' | null;

@Component({
  selector: 'app-usuarios-page',
  standalone: true,
  imports: [NgIf, FormsModule, StatusBannerComponent, UsuarioFormComponent, UsuariosListComponent],
  templateUrl: './usuarios-page.component.html',
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

    .empresa-grupo { margin-bottom: 1.5rem; }
    .empresa-titulo {
      font-size: .8rem;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: .6px;
      margin: 0 0 .5rem;
      padding: .4rem .6rem;
      background: rgba(34,33,33,.05);
      border-radius: 6px;
    }
  `],
})
export class UsuariosPageComponent implements OnInit {
  protected readonly service         = inject(UsuariosService);
  protected readonly clientesService  = inject(ClientesService);
  protected readonly centrosService   = inject(CentrosService);

  protected modal    = signal<ModalMode>(null);
  protected busqueda = signal('');

  protected usuariosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.service.usuarios();
    return this.service.usuarios().filter(u =>
      u.nombre.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  protected usuariosAgrupados = computed(() => {
    const clientes = this.clientesService.clientes();
    const usuarios = this.service.usuarios();
    const grupos = new Map<string, { empresa: string; usuarios: typeof usuarios }>();

    for (const u of usuarios) {
      const cid = u.cliente_id ? String(u.cliente_id) : '__sin_empresa__';
      if (!grupos.has(cid)) {
        const cliente = clientes.find(c => asId(c._id) === cid);
        grupos.set(cid, {
          empresa: cliente?.razon_social ?? (cid === '__sin_empresa__' ? 'Sin empresa asignada' : 'Empresa desconocida'),
          usuarios: [],
        });
      }
      grupos.get(cid)!.usuarios.push(u);
    }

    return [...grupos.values()].sort((a, b) => a.empresa.localeCompare(b.empresa));
  });

  ngOnInit(): void {
    this.service.cargar();
    this.clientesService.cargar();
    this.centrosService.cargar();
  }

  protected abrirCrear(): void {
    this.service.seleccionado.set(null);
    this.service.permisosSeleccionados.set([]);
    this.service.clearStatus();
    this.modal.set('crear');
  }

  protected abrirBuscar(): void {
    this.busqueda.set('');
    this.service.clearStatus();
    this.modal.set('buscar');
  }

  protected abrirEditar(usuario: Usuario): void {
    this.service.seleccionar(usuario);
    this.modal.set('editar');
  }

  protected cerrar(): void {
    this.modal.set(null);
    this.service.seleccionado.set(null);
    this.service.permisosSeleccionados.set([]);
    this.service.clearStatus();
  }

  protected crear(output: UsuarioFormOutput): void {
    this.service.crear(output.dto, output.permisos);
  }

  protected actualizar(output: UsuarioFormOutput): void {
    const id = this.service.seleccionado()?._id;
    if (!id) return;
    const centrosDisponibles = this.centrosService.centros()
      .filter(c => asId(c.cliente_id) === asId(output.dto.cliente_id));
    const permisos = output.permisos.filter(p =>
      centrosDisponibles.some(c => asId(c._id) === asId(p.centro_costo_id))
    );
    this.service.actualizar(id, {
      nombre: output.dto.nombre,
      email: output.dto.email,
      rol: output.dto.rol,
      permiso_acceso: output.dto.permiso_acceso,
      permisos,
    });
  }

  protected eliminar(id: string): void { this.service.eliminar(id); }

  protected editarDesdeBuscar(usuario: Usuario): void {
    this.service.seleccionar(usuario);
    this.modal.set('editar');
  }
}
