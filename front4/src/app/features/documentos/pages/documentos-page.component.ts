import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentosService, DocTipo } from '../documentos.service';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { asId } from '../../../shared/utils';

@Component({
  selector: 'app-documentos-page',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, StatusBannerComponent],
  templateUrl: './documentos-page.component.html',
})
export class DocumentosPageComponent implements OnInit {
  protected readonly service = inject(DocumentosService);
  protected readonly clientesService = inject(ClientesService);
  protected readonly centrosService = inject(CentrosService);
  protected readonly proyectosService = inject(ProyectosService);

  protected selectedEmpresaId = '';
  protected selectedCentroId  = '';
  protected selectedProyectoId = '';

  ngOnInit(): void {
    this.clientesService.cargar();
    this.centrosService.cargar();
    this.proyectosService.cargar();
    // Documentos se cargan solo cuando el usuario selecciona empresa/centro/proyecto
  }

  get centrosFiltrados() {
    if (!this.selectedEmpresaId) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === this.selectedEmpresaId);
  }

  get proyectosFiltrados() {
    if (!this.selectedEmpresaId || !this.selectedCentroId) return [];
    return this.proyectosService.proyectos().filter(p =>
      asId(p.cliente_id) === this.selectedEmpresaId && asId(p.centro_costo_id) === this.selectedCentroId
    );
  }

  get empresaNombre() { return this.clientesService.clientes().find(c => c._id === this.selectedEmpresaId)?.razon_social; }
  get centroNombre()  { return this.centrosService.centros().find(c => c._id === this.selectedCentroId)?.nombre; }
  get proyectoNombre(){ return this.proyectosService.proyectos().find(p => p._id === this.selectedProyectoId)?.nombre; }

  onEmpresaChange(): void {
    this.selectedCentroId = '';
    this.selectedProyectoId = '';
    this.service.cargar('empresa', this.empresaNombre);
  }

  onCentroChange(): void {
    this.selectedProyectoId = '';
    this.service.cargar('centro', this.empresaNombre, this.centroNombre);
  }

  onProyectoChange(): void {
    this.service.cargar('proyecto', this.empresaNombre, this.centroNombre, this.proyectoNombre);
  }

  onFileChange(ev: Event, tipo: DocTipo): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.service.subir(
      file, tipo,
      this.empresaNombre, this.centroNombre, this.proyectoNombre,
      this.selectedCentroId || undefined,
      this.selectedProyectoId || undefined,
    );
    (ev.target as HTMLInputElement).value = '';
  }

  eliminar(filename: string, tipo: DocTipo): void {
    this.service.eliminar(filename, tipo, this.empresaNombre, this.centroNombre, this.proyectoNombre);
  }
}
