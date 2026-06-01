import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CentroCostoDocument } from './centros-costos.schema';
import { CreateCentroCostoDto, UpdateCentroCostoDto } from './centros-costos.dto';

@Injectable()
export class CentrosCostosService {
  constructor(
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
  ) {}

  private toObjectId(value: string) {
    return new Types.ObjectId(value);
  }

  async create(dto: CreateCentroCostoDto) {
    const existe = await this.centroCostoModel.findOne({
      cliente_id: dto.cliente_id,
      codigo: dto.codigo,
    });
    if (existe) throw new ConflictException(`Ya existe el código ${dto.codigo} en este cliente`);
    return new this.centroCostoModel({
      ...dto,
      cliente_id: this.toObjectId(dto.cliente_id!),
    }).save();
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

  async agregarDocumento(
    id: string,
    archivo: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    nombreDisplay?: string,
    usuarioId?: string,
  ) {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const nombre = `${timestamp}_${rand}_${archivo.originalname}`;
    const nuevoDoc: Record<string, unknown> = {
      nombre,
      nombre_display: nombreDisplay?.trim() || archivo.originalname,
      tipo_mime: archivo.mimetype,
      tamano_bytes: archivo.size,
      contenido: archivo.buffer,
      subido_en: new Date(),
    };
    if (usuarioId) nuevoDoc['subido_por'] = new Types.ObjectId(usuarioId);
    const centro = await this.centroCostoModel
      .findByIdAndUpdate(id, { $push: { documentos: nuevoDoc } }, { new: true })
      .select('-documentos.contenido')
      .lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return centro.documentos[centro.documentos.length - 1];
  }

  async listarDocumentos(id: string) {
    const centro = await this.centroCostoModel.findById(id).select('-documentos.contenido').lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return centro.documentos;
  }

  async servirDocumento(centroId: string, docId: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    const centro = await this.centroCostoModel.findById(centroId);
    if (!centro) throw new NotFoundException(`Centro de costos ${centroId} no encontrado`);
    const doc = centro.documentos.find(d => String((d as any)._id) === docId);
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);
    const raw = doc.contenido as unknown;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    return { buffer, tipo_mime: doc.tipo_mime, nombre_display: doc.nombre_display };
  }

  async eliminarDocumento(centroId: string, docId: string) {
    const centro = await this.centroCostoModel
      .findByIdAndUpdate(
        centroId,
        { $pull: { documentos: { _id: new Types.ObjectId(docId) } } },
        { new: true },
      )
      .lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${centroId} no encontrado`);
    return { message: 'Documento eliminado', docId };
  }
}
