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
    .suscripciones-layout {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 1.25rem;
      align-items: start;
    }
    @container (max-width: 640px) {
      .suscripciones-layout { grid-template-columns: 1fr; }
    }
    .arbol {
      max-height: 45vh;
      overflow-y: auto;
      border: 1px solid rgba(34,33,33,.1);
      border-radius: 10px;
    }
    .resumen-titulo {
      font-size: 0.82rem;
      font-weight: 700;
      color: #374151;
      margin: 0 0 0.6rem;
    }
    .resumen-box {
      border: 1px solid rgba(34,33,33,.1);
      border-radius: 10px;
      padding: 0.85rem 0.9rem;
      max-height: 45vh;
      overflow-y: auto;
      background: rgba(34,33,33,.015);
    }
    .resumen-general {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: #6b7280;
      margin: 0 0 0.9rem;
      padding: 0.6rem 0.75rem;
      border-radius: 8px;
      background: rgba(34,33,33,.04);
      border: 1px solid transparent;
    }
    .resumen-general svg { flex-shrink: 0; margin-top: 1px; color: #9ca3af; }
    .resumen-general.activo {
      color: #0075a8;
      background: rgba(0,149,214,.12);
      border-color: rgba(0,149,214,.3);
    }
    .resumen-general.activo svg { color: #0095d6; }
    .resumen-item {
      font-size: 0.85rem;
      color: #374151;
      margin: 0 0 0.35rem;
      padding-left: 0.1rem;
    }
    .resumen-item small { color: #9ca3af; }
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
      color: #6b7280;
      padding: 0.4rem;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform .15s, background-color .15s;
    }
    .btn-expand:hover { background: rgba(34,33,33,.07); color: #1f2937; }
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
  }

  get resumenEmpresas(): Cliente[] {
    return this.empresas.filter((e) => this.empresasSet.has(asId(e._id)));
  }

  get resumenCentros(): { centro: CentroCosto; empresa?: Cliente }[] {
    return this.centros
      .filter((c) => this.centrosSet.has(asId(c._id)))
      .map((centro) => ({
        centro,
        empresa: this.empresas.find((e) => asId(e._id) === asId(centro.cliente_id)),
      }));
  }

  get resumenProyectos(): { proyecto: Proyecto; empresa?: Cliente }[] {
    return this.proyectos
      .filter((p) => this.proyectosSet.has(asId(p._id)))
      .map((proyecto) => ({
        proyecto,
        empresa: this.empresas.find((e) => asId(e._id) === asId(proyecto.cliente_id)),
      }));
  }

  get tieneSuscripcionesPuntuales(): boolean {
    return (
      this.resumenEmpresas.length > 0 ||
      this.resumenCentros.length > 0 ||
      this.resumenProyectos.length > 0
    );
  }

  get grupos(): EmpresaGrupo[] {
    return this.empresas
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
