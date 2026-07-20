import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { resolverSubidoPorNombre } from '../common/helpers/documentos.helper';
import { ClienteDocument } from '../clientes/clientes.schema';
import { DocClienteDocument } from '../clientes/doc-cliente.schema';
import { CentroCostoDocument } from '../centros-costos/centros-costos.schema';
import { DocCentroCostoDocument } from '../centros-costos/doc-centro-costo.schema';
import { ProyectoDocument } from '../proyectos/proyectos.schema';
import { DocProyectoDocument } from '../proyectos/doc-proyecto.schema';

export type NivelBusqueda = 'empresa' | 'centro' | 'proyecto';

export interface DocBusquedaItem {
  _id: string;
  nombre_display: string;
  categoria?: string;
  tipo_mime?: string;
  tamano_bytes?: number;
  subido_en?: Date;
  subido_por_nombre?: string;
  tipo_contenido?: string;
  link_url?: string;
}

export interface NodoBusqueda {
  _id: string;
  nombre: string;
  nivel: NivelBusqueda;
  empresa_id: string;
  empresa_nombre: string;
  centro_id?: string;
  centro_nombre?: string;
  documentos: DocBusquedaItem[];
  centros: NodoBusqueda[];
  proyectos: NodoBusqueda[];
}

function mapDoc(d: Record<string, any>): DocBusquedaItem {
  return {
    _id: String(d._id),
    nombre_display: d.nombre_display,
    categoria: d.categoria,
    tipo_mime: d.tipo_mime,
    tamano_bytes: d.tamano_bytes,
    subido_en: d.subido_en,
    subido_por_nombre: d.subido_por_nombre,
    tipo_contenido: d.tipo_contenido,
    link_url: d.link_url,
  };
}

function groupBy<T extends Record<string, any>>(arr: T[], key: string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of arr) {
    const k = String(item[key]);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(item);
  }
  return m;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class DocumentosBusquedaService {
  constructor(
    @InjectModel('Cliente')        private readonly clienteModel: Model<ClienteDocument>,
    @InjectModel('CentroCosto')    private readonly centroModel: Model<CentroCostoDocument>,
    @InjectModel('Proyecto')       private readonly proyectoModel: Model<ProyectoDocument>,
    @InjectModel('DocCliente')     private readonly docClienteModel: Model<DocClienteDocument>,
    @InjectModel('DocCentroCosto') private readonly docCentroModel: Model<DocCentroCostoDocument>,
    @InjectModel('DocProyecto')    private readonly docProyectoModel: Model<DocProyectoDocument>,
    @InjectModel('Usuario')        private readonly usuarioModel: Model<any>,
  ) {}

  async buscar(nivel: NivelBusqueda, categorias?: string[], nombre?: string): Promise<NodoBusqueda[]> {
    const arbol = await this.construirArbol(categorias, nombre);
    if (nivel === 'empresa') return arbol;
    const todosCentros = arbol.flatMap(e => e.centros);
    if (nivel === 'centro') return todosCentros;
    return todosCentros.flatMap(c => c.proyectos);
  }

  private async construirArbol(categorias?: string[], nombre?: string): Promise<NodoBusqueda[]> {
    const filtroDocs: Record<string, unknown> = {};
    if (categorias?.length) filtroDocs['categoria'] = { $in: categorias };
    if (nombre?.trim())     filtroDocs['nombre_display'] = { $regex: escapeRegExp(nombre.trim()), $options: 'i' };
    const hayFiltro = !!(categorias?.length || nombre?.trim());

    const [clientes, centros, proyectos, docsEmpresaRaw, docsCentroRaw, docsProyectoRaw] = await Promise.all([
      this.clienteModel.find({ activo: true }).select('razon_social').lean(),
      this.centroModel.find({ activo: true }).select('nombre cliente_id').lean(),
      this.proyectoModel.find({}).select('nombre cliente_id centro_costo_ids').lean(),
      this.docClienteModel.find(filtroDocs).select('-contenido').lean(),
      this.docCentroModel.find(filtroDocs).select('-contenido').lean(),
      this.docProyectoModel.find(filtroDocs).select('-contenido').lean(),
    ]);

    const [docsEmpresa, docsCentro, docsProyecto] = await Promise.all([
      resolverSubidoPorNombre(docsEmpresaRaw, this.usuarioModel),
      resolverSubidoPorNombre(docsCentroRaw, this.usuarioModel),
      resolverSubidoPorNombre(docsProyectoRaw, this.usuarioModel),
    ]);

    const docsPorEmpresa   = groupBy(docsEmpresa, 'cliente_id');
    const docsPorCentro    = groupBy(docsCentro, 'centro_costo_id');
    const docsPorProyecto  = groupBy(docsProyecto, 'proyecto_id');

    const nodos: NodoBusqueda[] = [];
    for (const emp of clientes) {
      const empresaId = String(emp._id);
      const centrosDeEmpresa = centros.filter(c => String(c.cliente_id) === empresaId);
      const nodosCentro: NodoBusqueda[] = [];

      for (const c of centrosDeEmpresa) {
        const centroId = String(c._id);
        const proyectosDelCentro = proyectos.filter(
          p => (p.centro_costo_ids ?? []).some(id => String(id) === centroId),
        );
        const nodosProyecto: NodoBusqueda[] = [];

        for (const p of proyectosDelCentro) {
          const docsP = (docsPorProyecto.get(String(p._id)) ?? []).map(mapDoc);
          if (hayFiltro && docsP.length === 0) continue;
          nodosProyecto.push({
            _id: String(p._id), nombre: p.nombre, nivel: 'proyecto',
            empresa_id: empresaId, empresa_nombre: emp.razon_social,
            centro_id: centroId, centro_nombre: c.nombre,
            documentos: docsP, centros: [], proyectos: [],
          });
        }

        const docsC = (docsPorCentro.get(centroId) ?? []).map(mapDoc);
        if (hayFiltro && docsC.length === 0 && nodosProyecto.length === 0) continue;
        nodosCentro.push({
          _id: centroId, nombre: c.nombre, nivel: 'centro',
          empresa_id: empresaId, empresa_nombre: emp.razon_social,
          documentos: docsC, centros: [], proyectos: nodosProyecto,
        });
      }

      const docsE = (docsPorEmpresa.get(empresaId) ?? []).map(mapDoc);
      if (hayFiltro && docsE.length === 0 && nodosCentro.length === 0) continue;
      nodos.push({
        _id: empresaId, nombre: emp.razon_social, nivel: 'empresa',
        empresa_id: empresaId, empresa_nombre: emp.razon_social,
        documentos: docsE, centros: nodosCentro, proyectos: [],
      });
    }
    return nodos;
  }
}
