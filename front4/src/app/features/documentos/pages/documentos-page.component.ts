import { Component, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentosService, DocTipo, CATEGORIAS_DOCUMENTO, DocumentoItem } from '../documentos.service';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { asId } from '../../../shared/utils';

interface PanelState {
  showUpload: boolean;
  showFilter: boolean;
  nombreInput: string;
  categoriaInput: string;
  filtroCategoria: string;
  selectedFile: File | null;
}

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

  protected readonly categorias = CATEGORIAS_DOCUMENTO;

  protected selectedEmpresaId  = '';
  protected selectedCentroId   = '';
  protected selectedProyectoId = '';

  protected panels: Record<DocTipo, PanelState> = {
    empresa:  this.emptyPanel(),
    centro:   this.emptyPanel(),
    proyecto: this.emptyPanel(),
  };

  private emptyPanel(): PanelState {
    return { showUpload: false, showFilter: false, nombreInput: '', categoriaInput: 'Contrato', filtroCategoria: 'Todos', selectedFile: null };
  }

  ngOnInit(): void {
    this.clientesService.cargar();
    this.centrosService.cargar();
    this.proyectosService.cargar();
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

  toggleUpload(tipo: DocTipo): void {
    const p = this.panels[tipo];
    p.showUpload = !p.showUpload;
    if (p.showUpload) p.showFilter = false;
    if (!p.showUpload) { p.selectedFile = null; p.nombreInput = ''; }
  }

  toggleFilter(tipo: DocTipo): void {
    const p = this.panels[tipo];
    p.showFilter = !p.showFilter;
    if (p.showFilter) p.showUpload = false;
  }

  onFileSelected(ev: Event, tipo: DocTipo): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const p = this.panels[tipo];
    p.selectedFile = file;
    if (!p.nombreInput) p.nombreInput = file.name.replace(/\.[^/.]+$/, '');
  }

  confirmarSubida(tipo: DocTipo): void {
    const p = this.panels[tipo];
    if (!p.selectedFile) return;
    this.service.subir(
      p.selectedFile, tipo,
      this.empresaNombre, this.centroNombre, this.proyectoNombre,
      this.selectedCentroId || undefined,
      this.selectedProyectoId || undefined,
      p.nombreInput || undefined,
      p.categoriaInput || undefined,
    );
    p.selectedFile = null;
    p.nombreInput = '';
    p.showUpload = false;
  }

  docsFiltrados(tipo: DocTipo): DocumentoItem[] {
    const filtro = this.panels[tipo].filtroCategoria;
    const docs = tipo === 'empresa' ? this.service.documentosEmpresa()
      : tipo === 'centro' ? this.service.documentosCentro()
      : this.service.documentosProyecto();
    if (!filtro || filtro === 'Todos') return docs;
    return docs.filter(d => d.categoria === filtro);
  }

  eliminar(filename: string, tipo: DocTipo): void {
    this.service.eliminar(filename, tipo, this.empresaNombre, this.centroNombre, this.proyectoNombre);
  }
}
