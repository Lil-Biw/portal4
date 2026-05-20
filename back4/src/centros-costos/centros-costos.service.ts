import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CentroCostoDocument } from './centros-costos.schema';
import { CreateCentroCostoDto, UpdateCentroCostoDto, AgregarDocumentoDto } from './centros-costos.dto';

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
      cliente_id: this.toObjectId(dto.cliente_id),
    }).save();
  }

  async findAll(page = 1, limit = 20) {
    const filter = { activo: true };
    const [data, total] = await Promise.all([
      this.centroCostoModel.find(filter).skip((page - 1) * limit).limit(limit).lean(),
      this.centroCostoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findAllByCliente(cliente_id: string, page = 1, limit = 20) {
    const filter = { cliente_id: new Types.ObjectId(cliente_id), activo: true };
    const [data, total] = await Promise.all([
      this.centroCostoModel.find(filter).skip((page - 1) * limit).limit(limit).lean(),
      this.centroCostoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findByIds(ids: string[]) {
    return this.centroCostoModel
      .find({ _id: { $in: ids.map(id => new Types.ObjectId(id)) }, activo: true })
      .lean();
  }

  async findOne(id: string) {
    const centro = await this.centroCostoModel.findById(id).lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return centro;
  }

  async update(id: string, dto: UpdateCentroCostoDto) {
    const payload: Record<string, unknown> = { ...dto };
    if (dto.cliente_id) {
      payload['cliente_id'] = this.toObjectId(dto.cliente_id);
    }

    const centro = await this.centroCostoModel
      .findByIdAndUpdate(id, payload, { new: true })
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

  async agregarDocumento(id: string, dto: AgregarDocumentoDto, usuarioId?: string) {
    const nuevoDoc: any = { ...dto, subido_en: new Date() };
    if (usuarioId) nuevoDoc.subido_por = new Types.ObjectId(usuarioId);
    const centro = await this.centroCostoModel
      .findByIdAndUpdate(id, { $push: { documentos: nuevoDoc } }, { new: true })
      .lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return centro.documentos[centro.documentos.length - 1];
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
