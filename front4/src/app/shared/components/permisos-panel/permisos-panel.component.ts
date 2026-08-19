import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PERM_SCHEMA, PermisoRow, PermisoSeccion, PermisosUsuario, filaAplica } from '../../models/permisos.model';

@Component({
  selector: 'app-permisos-panel',
  standalone: true,
  imports: [],
  templateUrl: './permisos-panel.component.html',
  styles: [`
    .pf-seccion {
      display: flex; flex-direction: column; gap: .7rem;
      --pf-color: var(--sc-cyan-pressed);
      --pf-color-suave: var(--sc-cyan-tint-12);
    }
    .pf-seccion + .pf-seccion { margin-top: 1.4rem; }
    .pf-seccion-titulo {
      margin: 0;
      font-size: .7rem; font-weight: 700;
      letter-spacing: .08em; text-transform: uppercase;
      color: var(--pf-color);
      display: flex; align-items: center; gap: .6rem;
    }
    .pf-seccion-titulo::after { content: ""; flex: 1; height: 1px; background: var(--pf-color-suave); opacity: .55; }
    .pf-seccion-nota {
      font-size: .68rem; font-weight: 700; letter-spacing: .02em;
      color: var(--pf-color); text-transform: none;
      padding: .05rem .5rem; border: 1px dashed var(--pf-color-suave); border-radius: 999px;
    }

    .perm-panel {
      border: 1px solid var(--border-default);
      border-left: 3px solid var(--pf-color-suave);
      border-radius: 10px;
      background: var(--bg-1);
      overflow: hidden;
    }
    .perm-row { display: flex; align-items: center; gap: 1rem; padding: .68rem .9rem; }
    .perm-row + .perm-row { border-top: 1px solid var(--border-subtle); }
    .perm-row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .1rem; }
    .perm-row-label { font-size: .86rem; font-weight: 600; color: var(--fg-1); }
    .perm-row-hint { font-size: .76rem; color: var(--fg-3); line-height: 1.4; }
    .perm-row--disabled .perm-row-label { color: var(--fg-5); }
    .perm-row--disabled .perm-row-hint { color: var(--fg-5); }

    .pf-switch {
      position: relative; flex-shrink: 0;
      width: 40px; height: 22px; border-radius: 999px;
      border: none; padding: 0; cursor: pointer;
      background: var(--bg-3);
      transition: background .16s;
    }
    .pf-switch::after {
      content: ""; position: absolute; top: 2px; left: 2px;
      width: 18px; height: 18px; border-radius: 999px;
      background: var(--bg-0); box-shadow: var(--shadow-1);
      transition: transform .16s;
    }
    .pf-switch[aria-pressed="true"] { background: var(--pf-color); }
    .pf-switch[aria-pressed="true"]::after { transform: translateX(18px); }
    .pf-switch:disabled { cursor: not-allowed; opacity: .55; }
    .pf-switch:focus-visible { outline: 2px solid var(--pf-color); outline-offset: 2px; }
  `],
})
export class PermisosPanelComponent {
  @Input() valores: PermisosUsuario = {};
  @Input() contextoCompleto = true;
  @Output() valoresChange = new EventEmitter<PermisosUsuario>();

  readonly schema = PERM_SCHEMA;

  aplica(seccion: PermisoSeccion, row: PermisoRow): boolean {
    return filaAplica(seccion, row, this.contextoCompleto);
  }

  activo(seccionKey: string, rowKey: string): boolean {
    return !!this.valores?.[seccionKey]?.[rowKey];
  }

  toggle(seccionKey: string, rowKey: string): void {
    const seccionActual = this.valores?.[seccionKey] ?? {};
    const siguiente: PermisosUsuario = {
      ...this.valores,
      [seccionKey]: { ...seccionActual, [rowKey]: !this.activo(seccionKey, rowKey) },
    };
    this.valoresChange.emit(siguiente);
  }
}
