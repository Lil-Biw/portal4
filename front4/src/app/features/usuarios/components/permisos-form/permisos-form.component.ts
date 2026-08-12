import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PermisosPanelComponent } from '../../../../shared/components/permisos-panel/permisos-panel.component';
import { Usuario, RolUsuario } from '../../../../shared/models/usuario.model';
import { PERM_SCHEMA, PermisosUsuario, Rol, contarPermisosActivos, filaAplica } from '../../../../shared/models/permisos.model';

@Component({
  selector: 'app-permisos-form',
  standalone: true,
  imports: [FormsModule, PermisosPanelComponent],
  templateUrl: './permisos-form.component.html',
  styles: [`
    .pfm-header { display: flex; align-items: center; gap: .85rem; margin-bottom: 1.1rem; }
    .pfm-avatar {
      width: 40px; height: 40px; border-radius: 999px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: .9rem; color: #fff;
    }
    .pfm-avatar-usuario { background: #6b7280; }
    .pfm-avatar-admin   { background: #0095d6; }
    .pfm-avatar-super   { background: #f59e0b; }
    .pfm-identity { display: flex; flex-direction: column; gap: .15rem; min-width: 0; flex: 1; }
    .pfm-identity-top { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .pfm-identity-top h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #111827; }
    .pfm-role-chip {
      font-size: .68rem; font-weight: 700; letter-spacing: .03em;
      padding: .14rem .55rem; border-radius: 999px;
      background: rgba(0,149,214,.12); color: #0075a8;
    }
    .pfm-identity-sub { font-size: .78rem; color: #6b7280; }

    .pfm-rol-preset {
      display: flex; align-items: center; gap: .6rem;
      padding: .6rem .8rem; margin-bottom: 1.1rem;
      background: rgba(0,149,214,.06); border-radius: 10px;
      font-size: .82rem; font-weight: 600; color: #374151;
    }
    .pfm-rol-preset select {
      flex: 1; padding: .4rem .6rem; border-radius: 7px;
      border: 1px solid rgba(34,33,33,.18); font-family: inherit; font-size: .84rem;
      background: #fff; color: #1f2937;
    }

    .pfm-footer {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      margin-top: 1.4rem; padding-top: .9rem;
      border-top: 1px solid rgba(34,33,33,.1);
    }
    .pfm-footer-contador { font-size: .82rem; color: #374151; }
    .pfm-footer-contador strong { font-variant-numeric: tabular-nums; color: #111827; }
    .pfm-footer-actions { display: flex; gap: .6rem; }
  `],
})
export class PermisosFormComponent implements OnChanges {
  @Input() usuario: Usuario | null = null;
  @Input() roles: Rol[] = [];
  @Output() guardado = new EventEmitter<PermisosUsuario>();
  @Output() cancelado = new EventEmitter<void>();

  valores: PermisosUsuario = {};
  rolSeleccionadoId = '';

  ngOnChanges(): void {
    this.valores = structuredClone(this.usuario?.permisos ?? {});
    this.rolSeleccionadoId = '';
  }

  get contextoCompleto(): boolean {
    return this.usuario?.rol !== 'usuario';
  }

  get contador(): { activos: number; total: number } {
    return contarPermisosActivos(this.valores, this.contextoCompleto);
  }

  onValoresChange(v: PermisosUsuario): void {
    this.valores = v;
  }

  aplicarRol(rolId: string): void {
    this.rolSeleccionadoId = rolId;
    const rol = this.roles.find((r) => r._id === rolId);
    if (!rol) return;
    const copia = structuredClone(rol.permisos ?? {});
    if (!this.contextoCompleto) {
      for (const seccion of PERM_SCHEMA) {
        for (const row of seccion.rows) {
          if (!filaAplica(seccion, row, false)) {
            delete copia[seccion.key]?.[row.key];
          }
        }
        if (copia[seccion.key] && Object.keys(copia[seccion.key]).length === 0) {
          delete copia[seccion.key];
        }
      }
    }
    this.valores = copia;
  }

  iniciales(nombre: string): string {
    const partes = nombre.trim().split(/\s+/);
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return nombre.slice(0, 2).toUpperCase();
  }

  rolClase(rol: RolUsuario): string {
    if (rol === 'super_admin') return 'super';
    if (rol === 'admin_smartclarity') return 'admin';
    return 'usuario';
  }

  rolLabel(rol: RolUsuario): string {
    if (rol === 'super_admin') return 'Super Admin';
    if (rol === 'admin_smartclarity') return 'Admin SmartClarity';
    return 'Usuario';
  }

  submit(): void {
    this.guardado.emit(this.valores);
  }
}
