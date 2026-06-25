import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProyectoDocument } from './proyectos.schema';
import { CreateProyectoDto, UpdateProyectoDto } from './proyectos.dto';
import { DocumentosHelper, ArchivoInput } from '../common/helpers/documentos.helper';
import { DocumentosVencidosService } from '../documentos-vencidos/documentos-vencidos.service';

@Injectable()
export class ProyectosService {
  private readonly docsHelper: DocumentosHelper;

  constructor(
    @InjectModel('Proyecto') private proyectoModel: Model<ProyectoDocument>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<any>,
    private readonly documentosVencidosService: DocumentosVencidosService,
  ) {
    this.docsHelper = new DocumentosHelper(proyectoModel, 'Proyecto');
  }

  private toObjectId(value: string) {
    return new Types.ObjectId(value);
  }

  private async validarCentroEnCliente(cliente_id: string, centro_costo_id: string) {
    const centro = await this.centroCostoModel.findOne({
      _id: this.toObjectId(centro_costo_id),
      cliente_id: this.toObjectId(cliente_id),
      activo: true,
    }).lean();
    if (!centro) throw new BadRequestException('El centro seleccionado no pertenece a la empresa indicada');
  }

  async create(dto: CreateProyectoDto, creadoPor?: string) {
    const existe = await this.proyectoModel.findOne({
      centro_costo_id: this.toObjectId(dto.centro_costo_id!),
      codigo: dto.codigo,
    });
    if (existe) throw new ConflictException(`Ya existe el código ${dto.codigo} en este centro de costos`);
    await this.validarCentroEnCliente(dto.cliente_id!, dto.centro_costo_id!);
    const doc: Record<string, unknown> = {
      ...dto,
      cliente_id: this.toObjectId(dto.cliente_id!),
      centro_costo_id: this.toObjectId(dto.centro_costo_id!),
      fecha_inicio: dto.fecha_inicio ? new Date(dto.fecha_inicio) : undefined,
      fecha_fin: dto.fecha_fin ? new Date(dto.fecha_fin) : undefined,
    };
    if (creadoPor) doc['creado_por'] = new Types.ObjectId(creadoPor);
    return new this.proyectoModel(doc).save();
  }

  async findAll(page = 1, limit = 20) {
    const filter = { estado: { $ne: 'cerrado' } };
    const [data, total] = await Promise.all([
      this.proyectoModel.find(filter).select('-documentos.contenido').skip((page - 1) * limit).limit(limit).lean(),
      this.proyectoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findAllByCliente(cliente_id: string, page = 1, limit = 100) {
    const filter = {
      cliente_id: new Types.ObjectId(cliente_id),
      estado: { $ne: 'cerrado' },
    };
    const [data, total] = await Promise.all([
      this.proyectoModel.find(filter).select('-documentos.contenido').skip((page - 1) * limit).limit(limit).lean(),
      this.proyectoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findAllByCentro(centro_costo_id: string, page = 1, limit = 20) {
    const filter = {
      centro_costo_id: new Types.ObjectId(centro_costo_id),
      estado: { $ne: 'cerrado' },
    };
    const [data, total] = await Promise.all([
      this.proyectoModel.find(filter).select('-documentos.contenido').skip((page - 1) * limit).limit(limit).lean(),
      this.proyectoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const proyecto = await this.proyectoModel.findById(id).select('-documentos.contenido').lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return proyecto;
  }

  async update(id: string, dto: UpdateProyectoDto) {
    const proyectoActual = await this.proyectoModel.findById(id).lean();
    if (!proyectoActual) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    const clienteId = dto.cliente_id || proyectoActual.cliente_id.toString();
    const centroCostoId = dto.centro_costo_id || proyectoActual.centro_costo_id.toString();
    await this.validarCentroEnCliente(clienteId, centroCostoId);
    const payload: Record<string, unknown> = { ...dto };
    if (dto.cliente_id) payload['cliente_id'] = this.toObjectId(dto.cliente_id);
    if (dto.centro_costo_id) payload['centro_costo_id'] = this.toObjectId(dto.centro_costo_id);
    const proyecto = await this.proyectoModel
      .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
      .select('-documentos.contenido')
      .lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return proyecto;
  }

  async remove(id: string) {
    const proyecto = await this.proyectoModel
      .findByIdAndUpdate(id, { estado: 'cerrado' }, { new: true })
      .lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return { message: 'Proyecto cerrado', id };
  }

  agregarDocumento(id: string, archivo: ArchivoInput, nombreDisplay?: string, categoria?: string, usuarioId?: string) {
    return this.docsHelper.agregar(id, archivo, nombreDisplay, categoria, usuarioId);
  }

  listarDocumentos(id: string) {
    return this.docsHelper.listar(id);
  }

  servirDocumento(proyectoId: string, docId: string) {
    return this.docsHelper.servir(proyectoId, docId);
  }

  eliminarDocumento(proyectoId: string, docId: string) {
    return this.docsHelper.eliminar(proyectoId, docId);
  }

  async vencerDocumento(
    proyectoId: string, docId: string,
    empresaId: string, centroId: string,
    empresaNombre?: string, centroNombre?: string, proyectoNombre?: string,
  ) {
    const proyecto = await this.proyectoModel.findById(proyectoId);
    if (!proyecto) throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    const doc = proyecto.documentos.find((d: any) => String(d._id) === docId);
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

    await this.proyectoModel.findByIdAndUpdate(
      proyectoId,
      { $pull: { documentos: { _id: (doc as any)._id } } },
    );

    await this.documentosVencidosService.crear({
      nombre_display:  doc.nombre_display,
      categoria:       doc.categoria,
      tipo_mime:       doc.tipo_mime,
      tamano_bytes:    doc.tamano_bytes,
      contenido:       doc.contenido,
      origen_tipo:     'proyecto',
      empresa_id:      empresaId,
      centro_id:       centroId,
      proyecto_id:     proyectoId,
      empresa_nombre:  empresaNombre,
      centro_nombre:   centroNombre,
      proyecto_nombre: proyectoNombre,
      subido_en:       doc.subido_en,
    });

    return { message: 'Documento marcado como vencido', docId };
  }
}
