import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import { UsuariosService } from '../usuarios.service';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import {
  UsuarioFormComponent,
  UsuarioFormOutput,
} from '../components/usuario-form/usuario-form.component';
import { UsuariosListComponent } from '../components/usuarios-list/usuarios-list.component';
import { Usuario } from '../../../shared/models/usuario.model';
import { asId } from '../../../shared/utils';

type ModalMode = 'crear-admin' | 'crear-usuario' | 'editar' | 'buscar' | null;

@Component({
  selector: 'app-usuarios-page',
  standalone: true,
  imports: [NgIf, FormsModule, StatusBannerComponent, UsuarioFormComponent, UsuariosListComponent],
  templateUrl: './usuarios-page.component.html',
  styles: [
    `
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
      .header-actions {
        display: flex;
        gap: 0.6rem;
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        padding: 1rem;
      }
      .modal {
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.18);
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
      .modal-header h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
      }
      .modal-close {
        background: none;
        border: none;
        font-size: 1.4rem;
        line-height: 1;
        cursor: pointer;
        color: #6b7280;
        padding: 0 0.25rem;
      }
      .modal-close:hover {
        color: #1f2937;
      }
      .search-input {
        width: 100%;
        padding: 0.65rem 0.9rem;
        border-radius: 8px;
        border: 1px solid rgba(34, 33, 33, 0.2);
        font-size: 0.9rem;
        font-family: inherit;
        margin-bottom: 1rem;
        box-sizing: border-box;
      }
      .search-input:focus {
        outline: none;
        border-color: #0095d6;
      }

      .empresa-grupo {
        margin-bottom: 1.5rem;
      }
      .empresa-titulo {
        font-size: 0.8rem;
        font-weight: 700;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        margin: 0 0 0.5rem;
        padding: 0.4rem 0.6rem;
        background: rgba(34, 33, 33, 0.05);
        border-radius: 6px;
      }
    `,
  ],
})
export class UsuariosPageComponent implements OnInit {
  protected readonly service = inject(UsuariosService);
  protected readonly clientesService = inject(ClientesService);
  protected readonly centrosService = inject(CentrosService);
  private readonly authService = inject(AuthService);

  protected esAdminSmartclarity = computed(
    () => this.authService.usuarioActual()?.rol === 'admin_smartclarity',
  );
  protected esSuperAdmin = computed(
    () => this.authService.usuarioActual()?.rol === 'super_admin',
  );

  protected clientesVisibles = computed(() => this.clientesService.clientes());

  protected centrosVisibles = computed(() => this.centrosService.centros());

  protected modal = signal<ModalMode>(null);
  protected busqueda = signal('');
  protected adminForm = { nombre: '', email: '' };

  protected usuariosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    const usuarios = this.usuariosVisibles();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  });

  protected usuariosVisibles = computed(() => this.service.usuarios());

  protected usuariosAgrupados = computed(() => {
    const clientes = this.clientesVisibles();
    const usuarios = this.usuariosVisibles();
    const grupos = new Map<string, { empresa: string; usuarios: typeof usuarios }>();

    for (const u of usuarios) {
      const cid = u.cliente_id ? String(u.cliente_id) : '__sin_empresa__';
      if (!grupos.has(cid)) {
        const cliente = clientes.find((c) => asId(c._id) === cid);
        grupos.set(cid, {
          empresa:
            cliente?.razon_social ??
            (cid === '__sin_empresa__' ? 'Sin empresa asignada' : 'Empresa desconocida'),
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

  protected abrirCrearUsuario(): void {
    this.service.seleccionado.set(null);
    this.service.centrosSeleccionados.set([]);
    this.service.clearStatus();
    this.modal.set('crear-usuario');
  }

  protected abrirCrearAdmin(): void {
    this.adminForm = { nombre: '', email: '' };
    this.service.clearStatus();
    this.modal.set('crear-admin');
  }

  protected abrirBuscar(): void {
    this.busqueda.set('');
    this.service.clearStatus();
    this.modal.set('buscar');
  }

  protected abrirEditar(usuario: Usuario): void {
    this.service.seleccionar(usuario); // carga centros_asignados desde el usuario
    this.modal.set('editar');
  }

  protected cerrar(): void {
    this.modal.set(null);
    this.service.seleccionado.set(null);
    this.service.centrosSeleccionados.set([]);
    this.service.clearStatus();
    this.adminForm = { nombre: '', email: '' };
  }

  protected crearAdmin(): void {
    this.service.crear({
      nombre: this.adminForm.nombre,
      email: this.adminForm.email,
      rol: 'admin_smartclarity',
      permiso_acceso: 'editar',
    });
  }

  protected crear(output: UsuarioFormOutput): void {
    this.service.crear(output.dto);
  }

  protected actualizar(output: UsuarioFormOutput): void {
    const id = this.service.seleccionado()?._id;
    if (!id) return;
    this.service.actualizar(id, {
      nombre: output.dto.nombre,
      email: output.dto.email,
      rol: this.esAdminSmartclarity() ? 'usuario' : output.dto.rol,
      permiso_acceso: output.dto.permiso_acceso,
      centros_asignados: output.dto.centros_asignados,
    });
  }

  protected eliminar(id: string): void {
    this.service.eliminar(id);
  }

  protected editarDesdeBuscar(usuario: Usuario): void {
    this.service.seleccionar(usuario);
    this.modal.set('editar');
  }
}
