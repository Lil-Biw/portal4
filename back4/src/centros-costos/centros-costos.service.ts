import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CentroCostoDocument } from './centros-costos.schema';
import { CreateCentroCostoDto, UpdateCentroCostoDto } from './centros-costos.dto';
import { DocumentosHelper, ArchivoInput } from '../common/helpers/documentos.helper';
import { DocumentosVencidosService } from '../documentos-vencidos/documentos-vencidos.service';

@Injectable()
export class CentrosCostosService {
  private readonly docsHelper: DocumentosHelper;

  constructor(
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
    private readonly documentosVencidosService: DocumentosVencidosService,
  ) {
    this.docsHelper = new DocumentosHelper(centroCostoModel, 'Centro de costos');
  }

  private toObjectId(value: string) {
    return new Types.ObjectId(value);
  }

  async create(dto: CreateCentroCostoDto) {
    const existe = await this.centroCostoModel.findOne({
      cliente_id: this.toObjectId(dto.cliente_id!),
      codigo: dto.codigo,
    });
    if (existe) throw new ConflictException(`El código "${dto.codigo}" ya existe en esta empresa. Usa un código distinto.`);
    try {
      return await new this.centroCostoModel({
        ...dto,
        cliente_id: this.toObjectId(dto.cliente_id!),
      }).save();
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException(`El código "${dto.codigo}" ya existe en esta empresa. Usa un código distinto.`);
      }
      throw err;
    }
  }

  async findAll(page = 1, limit = 20) {
    const filter = { activo: true };
    const [data, total] = await Promise.all([
      this.centroCostoModel.find(filter).select('-documentos.contenido').skip((page - 1) * limit).limit(limit).lean(),
      this.centroCostoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findAllByCliente(cliente_id: string, page = 1, limit = 20) {
    const filter = { cliente_id: new Types.ObjectId(cliente_id), activo: true };
    const [data, total] = await Promise.all([
      this.centroCostoModel.find(filter).select('-documentos.contenido').skip((page - 1) * limit).limit(limit).lean(),
      this.centroCostoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findByIds(ids: string[]) {
    return this.centroCostoModel
      .find({ _id: { $in: ids.map(id => new Types.ObjectId(id)) }, activo: true })
      .select('-documentos.contenido')
      .lean();
  }

  async findOne(id: string) {
    const centro = await this.centroCostoModel.findById(id).select('-documentos.contenido').lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return centro;
  }

  async update(id: string, dto: UpdateCentroCostoDto) {
    const payload: Record<string, unknown> = { ...dto };
    if (dto.cliente_id) payload['cliente_id'] = this.toObjectId(dto.cliente_id);
    const centro = await this.centroCostoModel
      .findByIdAndUpdate(id, payload, { new: true })
      .select('-documentos.contenido')
      .lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return centro;
  }

  async remove(id: string) {
    const centro = await this.centroCostoModel
      .findByIdAndUpdate(id, { activo: false }, { new: true })
      .lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return { message: 'Centro desactivado', id };
  }

  async updateScoreSmartclarity(centroId: string, valores: number[]) {
    const centro = await this.centroCostoModel
      .findByIdAndUpdate(centroId, { score_smartclarity: valores }, { new: true, runValidators: true })
      .select('-documentos.contenido')
      .lean();
    if (!centro) throw new NotFoundException(`Centro ${centroId} no encontrado`);
    return centro;
  }

  agregarDocumento(id: string, archivo: ArchivoInput, nombreDisplay?: string, categoria?: string, usuarioId?: string) {
    return this.docsHelper.agregar(id, archivo, nombreDisplay, categoria, usuarioId);
  }

  listarDocumentos(id: string) {
    return this.docsHelper.listar(id);
  }

  servirDocumento(centroId: string, docId: string) {
    return this.docsHelper.servir(centroId, docId);
  }

  eliminarDocumento(centroId: string, docId: string) {
    return this.docsHelper.eliminar(centroId, docId);
  }

  async vencerDocumento(centroId: string, docId: string, empresaId?: string, empresaNombre?: string, centroNombre?: string) {
    const centro = await this.centroCostoModel.findById(centroId);
    if (!centro) throw new NotFoundException(`Centro ${centroId} no encontrado`);
    const doc = centro.documentos.find((d: any) => String(d._id) === docId);
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

    const resolvedEmpresaId = empresaId ?? String(centro.cliente_id);

    await this.documentosVencidosService.crear({
      nombre_display: doc.nombre_display,
      categoria:      doc.categoria,
      tipo_mime:      doc.tipo_mime,
      tamano_bytes:   doc.tamano_bytes,
      origen_tipo:    'centro',
      empresa_id:     resolvedEmpresaId,
      centro_id:      centroId,
      empresa_nombre: empresaNombre,
      centro_nombre:  centroNombre,
      subido_en:      doc.subido_en,
    });

    await this.centroCostoModel.findByIdAndUpdate(
      centroId,
      { $pull: { documentos: { _id: (doc as any)._id } } },
    );

    return { message: 'Documento marcado como vencido', docId };
  }
}
