import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Usuario, RolUsuario } from '../../../../shared/models/usuario.model';

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  imports: [],
  templateUrl: './usuarios-list.component.html',
  styles: [`
    .user-list {
      background: var(--bg-0);
      border-radius: 12px;
      border: 1px solid var(--border-default);
      overflow: hidden;
    }
    .user-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--border-subtle);
    }
    .user-row:last-child { border-bottom: none; }

    .avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--fg-inverse);
      flex-shrink: 0;
      background: var(--fg-4);
    }
    .avatar-usuario        { background: var(--fg-4); }
    .avatar-admin          { background: var(--sc-cyan); }
    .avatar-super          { background: var(--warn); }

    .user-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .user-name  { font-size: 0.88rem; font-weight: 600; color: var(--fg-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-email { font-size: 0.78rem; color: var(--fg-4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .role-badge {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.22rem 0.65rem;
      border-radius: 999px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .badge-usuario { background: var(--bg-2);           color: var(--fg-3); }
    .badge-admin   { background: var(--sc-cyan-tint-12); color: var(--sc-cyan-pressed); }
    .badge-super   { background: var(--warn-bg);         color: var(--warn); }

    .permiso-badge {
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--fg-5);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .user-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.35rem;
      flex-shrink: 0;
    }
    .btn-icon-label {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      background: none;
      border: none;
      font-size: 0.78rem;
      font-weight: 500;
      color: var(--fg-4);
      cursor: pointer;
      padding: 0.35rem 0.55rem;
      border-radius: 6px;
      white-space: nowrap;
    }
    .btn-icon-label:hover:not(:disabled) { color: var(--fg-2); background: var(--border-subtle); }
    .btn-icon-label.danger:hover:not(:disabled) { background: var(--danger-bg); color: var(--danger); }
    .btn-icon-label:disabled { opacity: 0.35; cursor: not-allowed; }
  `],
})
export class UsuariosListComponent {
  @Input() usuarios: Usuario[] = [];
  @Input() seleccionadoId: string | null = null;
  @Input() usuarioActualId: string | null = null;
  @Input() puedeEditar = true;
  @Input() puedeEliminar = true;
  @Output() editado        = new EventEmitter<Usuario>();
  @Output() eliminado      = new EventEmitter<string>();
  @Output() suscripciones  = new EventEmitter<Usuario>();
  @Output() permisos       = new EventEmitter<Usuario>();

  esAdmin(u: Usuario): boolean {
    return u.rol === 'admin_smartclarity' || u.rol === 'super_admin';
  }

  esPropio(u: Usuario): boolean {
    return u._id === this.usuarioActualId;
  }

  initials(nombre: string): string {
    const parts = nombre.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return nombre.slice(0, 2).toUpperCase();
  }

  rolClass(rol: RolUsuario): string {
    if (rol === 'super_admin') return 'super';
    if (rol === 'admin_smartclarity') return 'admin';
    return 'usuario';
  }

  rolLabel(rol: RolUsuario): string {
    if (rol === 'super_admin') return 'Super Admin';
    if (rol === 'admin_smartclarity') return 'Admin SmartClarity';
    return 'Usuario';
  }

  accionLabel(u: Usuario): string {
    if (u.rol === 'super_admin') return 'Total';
    return u.permiso_acceso === 'editar' ? 'Editar' : 'Ver';
  }
}
