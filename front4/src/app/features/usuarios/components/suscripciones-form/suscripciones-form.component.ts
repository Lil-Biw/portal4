import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { Usuario, SuscripcionesDto } from '../../../../shared/models/usuario.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { Proyecto } from '../../../../shared/models/proyecto.model';
import { asId } from '../../../../shared/utils';

interface EmpresaGrupo {
  empresa: Cliente;
  centros: CentroCosto[];
  proyectos: Proyecto[];
}

@Component({
  selector: 'app-suscripciones-form',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  templateUrl: './suscripciones-form.component.html',
  styles: [`
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.75rem 0.9rem;
      background: rgba(0,149,214,.06);
      border-radius: 10px;
      margin-bottom: 1rem;
      font-size: 0.88rem;
      font-weight: 600;
      color: #1f2937;
    }
    .toggle-hint {
      font-weight: 400;
      color: #6b7280;
      font-size: 0.78rem;
      margin: -0.5rem 0 1rem;
    }
    :host {
      display: block;
      container-type: inline-size;
    }
    .arbol {
      max-height: 45vh;
      overflow-y: auto;
      border: 1px solid rgba(34,33,33,.1);
      border-radius: 10px;
    }
    .empresa-item {
      border-bottom: 1px solid rgba(34,33,33,.07);
    }
    .empresa-item:last-child { border-bottom: none; }
    .empresa-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.65rem 0.75rem;
    }
    .empresa-header label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      font-size: 0.88rem;
      font-weight: 600;
      color: #1f2937;
      cursor: pointer;
    }
    .btn-expand {
      background: none;
      border: none;
      cursor: pointer;
      color: #9ca3af;
      padding: 0.2rem;
      display: flex;
      transition: transform .15s;
    }
    .btn-expand.abierto { transform: rotate(90deg); }
    .empresa-detalle {
      padding: 0 0.75rem 0.75rem 2.1rem;
    }
    .subgrupo-titulo {
      font-size: 0.7rem;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin: 0.4rem 0 0.3rem;
    }
    .check-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: #374151;
      padding: 0.2rem 0;
      cursor: pointer;
    }
    .empty-sub {
      font-size: 0.8rem;
      color: #9ca3af;
      padding: 0.2rem 0;
    }
  `],
})
export class SuscripcionesFormComponent implements OnChanges {
  @Input() usuario: Usuario | null = null;
  @Input() empresas: Cliente[] = [];
  @Input() centros: CentroCosto[] = [];
  @Input() proyectos: Proyecto[] = [];
  @Output() guardado = new EventEmitter<SuscripcionesDto>();
  @Output() cancelado = new EventEmitter<void>();

  protected notificarTodas = true;
  protected busqueda = '';
  private empresasSet = new Set<string>();
  private centrosSet = new Set<string>();
  private proyectosSet = new Set<string>();
  private expandidas = new Set<string>();

  ngOnChanges(): void {
    this.notificarTodas = this.usuario?.notificar_todas_empresas ?? true;
    this.empresasSet = new Set((this.usuario?.empresas_suscritas ?? []).map((id) => asId(id)));
    this.centrosSet = new Set((this.usuario?.centros_suscritos ?? []).map((id) => asId(id)));
    this.proyectosSet = new Set((this.usuario?.proyectos_suscritos ?? []).map((id) => asId(id)));
    this.expandidas = new Set();
    this.busqueda = '';
  }

  get grupos(): EmpresaGrupo[] {
    const q = this.busqueda.toLowerCase().trim();
    return this.empresas
      .filter((e) => !q || e.razon_social.toLowerCase().includes(q))
      .map((empresa) => ({
        empresa,
        centros: this.centros.filter((c) => asId(c.cliente_id) === asId(empresa._id)),
        proyectos: this.proyectos.filter((p) => asId(p.cliente_id) === asId(empresa._id)),
      }))
      .sort((a, b) => a.empresa.razon_social.localeCompare(b.empresa.razon_social));
  }

  empresaChecked(id: string): boolean {
    return this.empresasSet.has(asId(id));
  }
  centroChecked(id: string): boolean {
    return this.centrosSet.has(asId(id));
  }
  proyectoChecked(id: string): boolean {
    return this.proyectosSet.has(asId(id));
  }
  isExpanded(id: string): boolean {
    return this.expandidas.has(asId(id));
  }

  toggleExpand(id: string): void {
    const key = asId(id);
    this.expandidas.has(key) ? this.expandidas.delete(key) : this.expandidas.add(key);
  }

  toggleEmpresa(id: string, checked: boolean): void {
    const key = asId(id);
    checked ? this.empresasSet.add(key) : this.empresasSet.delete(key);
  }
  toggleCentro(id: string, checked: boolean): void {
    const key = asId(id);
    checked ? this.centrosSet.add(key) : this.centrosSet.delete(key);
  }
  toggleProyecto(id: string, checked: boolean): void {
    const key = asId(id);
    checked ? this.proyectosSet.add(key) : this.proyectosSet.delete(key);
  }

  submit(): void {
    this.guardado.emit({
      notificar_todas_empresas: this.notificarTodas,
      empresas_suscritas: Array.from(this.empresasSet),
      centros_suscritos: Array.from(this.centrosSet),
      proyectos_suscritos: Array.from(this.proyectosSet),
    });
  }
}
