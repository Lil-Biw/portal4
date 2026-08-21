import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import { UsuariosService } from '../usuarios.service';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import {
  UsuarioFormComponent,
  UsuarioFormOutput,
} from '../components/usuario-form/usuario-form.component';
import { UsuariosListComponent } from '../components/usuarios-list/usuarios-list.component';
import { SuscripcionesFormComponent } from '../components/suscripciones-form/suscripciones-form.component';
import { RolesService } from '../roles.service';
import { PermisosFormComponent } from '../components/permisos-form/permisos-form.component';
import { RolesManagerComponent } from '../components/roles-manager/roles-manager.component';
import { PermisosUsuario, CreateRolDto, UpdateRolDto } from '../../../shared/models/permisos.model';
import { Usuario, SuscripcionesDto } from '../../../shared/models/usuario.model';
import { asId, confirmarEliminacion } from '../../../shared/utils';

type ModalMode = 'crear-admin' | 'crear-usuario' | 'editar' | 'suscripciones' | 'buscar' | 'permisos' | 'roles' | null;

@Component({
  selector: 'app-usuarios-page',
  standalone: true,
  imports: [
    NgIf,
    FormsModule,
    StatusBannerComponent,
    UsuarioFormComponent,
    UsuariosListComponent,
    SuscripcionesFormComponent,
    PermisosFormComponent,
    RolesManagerComponent,
  ],
  templateUrl: './usuarios-page.component.html',
  styles: [
    `
      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.5rem;
      }
      .header-title { display: flex; flex-direction: column; gap: 2px; }
      .page-header h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--fg-2);
      }
      .header-subtitle {
        margin: 0;
        font-size: .875rem;
        color: var(--fg-4);
      }
      .header-actions {
        display: flex;
        gap: 0.6rem;
        align-items: center;
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: var(--overlay);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        padding: 1rem;
      }
      .modal {
        background: var(--bg-0);
        border-radius: 16px;
        box-shadow: var(--shadow-4);
        width: 100%;
        max-width: 640px;
        max-height: 85vh;
        overflow-y: auto;
        padding: 1.5rem;
      }
      .modal.modal-ancho {
        max-width: 900px;
      }
      .modal.modal-permisos {
        display: flex;
        flex-direction: column;
        padding: 0;
        max-height: 85vh;
        overflow: hidden;
      }
      .modal.modal-permisos .modal-header {
        margin-bottom: 0;
        padding: 1.1rem 1.5rem;
        border-bottom: 1px solid var(--border-subtle);
        flex-shrink: 0;
      }
      .modal.modal-permisos app-status-banner {
        flex-shrink: 0;
      }
      .modal.modal-permisos app-permisos-form {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
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
        color: var(--fg-4);
        padding: 0 0.25rem;
      }
      .modal-close:hover {
        color: var(--fg-2);
      }
      .search-input {
        width: 100%;
        padding: 0.65rem 0.9rem;
        border-radius: 8px;
        border: 1px solid var(--border-strong);
        font-size: 0.9rem;
        font-family: inherit;
        margin-bottom: 1rem;
        box-sizing: border-box;
      }
      .search-input:focus {
        outline: none;
        border-color: var(--sc-cyan);
      }

      .empresa-grupo {
        margin-bottom: 1.5rem;
      }
      .empresa-titulo {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--fg-5);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        margin: 0 0 0.5rem;
        padding: 0 0.25rem;
      }
    `,
  ],
})
export class UsuariosPageComponent implements OnInit {
  protected readonly service = inject(UsuariosService);
  protected readonly clientesService = inject(ClientesService);
  protected readonly centrosService = inject(CentrosService);
  protected readonly proyectosService = inject(ProyectosService);
  protected readonly rolesService = inject(RolesService);
  protected readonly authService = inject(AuthService);

  constructor() {
    effect(() => {
      const modo = this.modal();
      if (
        this.service.status()?.type === 'ok' &&
        (modo === 'suscripciones' ||
          modo === 'permisos' ||
          modo === 'crear-usuario' ||
          modo === 'crear-admin' ||
          modo === 'editar')
      ) {
        this.cerrar();
      }
    });
  }

  protected usuarioActualId = computed(() => this.authService.usuarioActual()?.id ?? null);

  protected esAdminSmartclarity = computed(
    () => this.authService.usuarioActual()?.rol === 'admin_smartclarity',
  );
  protected esSuperAdmin = computed(
    () => this.authService.usuarioActual()?.rol === 'super_admin',
  );

  protected clientesVisibles = computed(() => this.clientesService.clientes());

  protected centrosVisibles = computed(() => this.centrosService.centros());

  protected proyectosVisibles = computed(() => this.proyectosService.proyectos());

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
    const grupos = new Map<string, { cid: string; empresa: string; usuarios: typeof usuarios }>();

    for (const u of usuarios) {
      const cid = u.cliente_id ? String(u.cliente_id) : '__sin_empresa__';
      if (!grupos.has(cid)) {
        const cliente = clientes.find((c) => asId(c._id) === cid);
        grupos.set(cid, {
          cid,
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
    this.proyectosService.cargar();
    this.rolesService.cargar();
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

  protected abrirSuscripciones(usuario: Usuario): void {
    if (usuario._id !== this.usuarioActualId()) return;
    this.service.seleccionado.set(usuario);
    this.service.clearStatus();
    this.modal.set('suscripciones');
  }

  protected guardarSuscripciones(dto: SuscripcionesDto): void {
    const id = this.service.seleccionado()?._id;
    if (!id) return;
    this.service.actualizarSuscripciones(id, dto);
  }

  protected abrirPermisos(usuario: Usuario): void {
    this.service.seleccionado.set(usuario);
    this.service.clearStatus();
    this.modal.set('permisos');
  }

  protected guardarPermisos(permisos: PermisosUsuario): void {
    const id = this.service.seleccionado()?._id;
    if (!id) return;
    this.service.actualizarPermisos(id, permisos);
    if (id === this.usuarioActualId()) {
      this.authService.actualizarUsuario({ permisos });
    }
  }

  protected abrirRoles(): void {
    this.rolesService.clearStatus();
    this.modal.set('roles');
  }

  protected crearRol(dto: CreateRolDto): void {
    this.rolesService.crear(dto);
  }

  protected actualizarRol(evento: { id: string; dto: UpdateRolDto }): void {
    this.rolesService.actualizar(evento.id, evento.dto);
  }

  protected eliminarRol(id: string): void {
    const rol = this.rolesService.roles().find(r => r._id === id);
    if (rol && !confirmarEliminacion(`el rol ${rol.nombre}`)) return;
    this.rolesService.eliminar(id);
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
      permisos: output.dto.permisos,
    });
  }

  protected eliminar(id: string): void {
    const usuario = this.service.usuarios().find(u => u._id === id);
    if (usuario && !confirmarEliminacion(usuario.nombre)) return;
    this.service.eliminar(id);
  }

  protected editarDesdeBuscar(usuario: Usuario): void {
    this.service.seleccionar(usuario);
    this.modal.set('editar');
  }
}
