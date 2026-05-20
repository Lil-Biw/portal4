import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProyectoDocument } from './proyectos.schema';
import { CreateProyectoDto, UpdateProyectoDto, AgregarDocumentoProyectoDto } from './proyectos.dto';

@Injectable()
export class ProyectosService {
  constructor(
    @InjectModel('Proyecto') private proyectoModel: Model<ProyectoDocument>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<any>,
  ) {}

  private toObjectId(value: string) {
    return new Types.ObjectId(value);
  }

  private async validarCentroEnCliente(cliente_id: string, centro_costo_id: string) {
    const centro = await this.centroCostoModel.findOne({
      _id: this.toObjectId(centro_costo_id),
      cliente_id: this.toObjectId(cliente_id),
      activo: true,
    }).lean();

    if (!centro) {
      throw new BadRequestException('El centro seleccionado no pertenece a la empresa indicada');
    }
  }

  async create(dto: CreateProyectoDto, creadoPor?: string) {
    const existe = await this.proyectoModel.findOne({
      centro_costo_id: this.toObjectId(dto.centro_costo_id),
      codigo: dto.codigo,
    });
    if (existe) throw new ConflictException(`Ya existe el código ${dto.codigo} en este centro de costos`);

    await this.validarCentroEnCliente(dto.cliente_id, dto.centro_costo_id);

    const doc: any = {
      ...dto,
      cliente_id: this.toObjectId(dto.cliente_id),
      centro_costo_id: this.toObjectId(dto.centro_costo_id),
      fecha_inicio: dto.fecha_inicio ? new Date(dto.fecha_inicio) : undefined,
      fecha_fin: dto.fecha_fin ? new Date(dto.fecha_fin) : undefined,
    };
    if (creadoPor) doc.creado_por = new Types.ObjectId(creadoPor);
    return new this.proyectoModel(doc).save();
  }

  async findAll(page = 1, limit = 20) {
    const filter = { estado: { $ne: 'cerrado' } };
    const [data, total] = await Promise.all([
      this.proyectoModel.find(filter).skip((page - 1) * limit).limit(limit).lean(),
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
      this.proyectoModel.find(filter).skip((page - 1) * limit).limit(limit).lean(),
      this.proyectoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const proyecto = await this.proyectoModel.findById(id).lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return proyecto;
  }

  async update(id: string, dto: UpdateProyectoDto) {
    const proyectoActual = await this.proyectoModel.findById(id).lean();
    if (!proyectoActual) throw new NotFoundException(`Proyecto ${id} no encontrado`);

    const clienteId = dto.cliente_id || proyectoActual.cliente_id.toString();
    const centroCostoId = dto.centro_costo_id || proyectoActual.centro_costo_id.toString();
    await this.validarCentroEnCliente(clienteId, centroCostoId);

    const payload: any = { ...dto };
    if (dto.cliente_id) {
      payload.cliente_id = this.toObjectId(dto.cliente_id);
    }
    if (dto.centro_costo_id) {
      payload.centro_costo_id = this.toObjectId(dto.centro_costo_id);
    }

    const proyecto = await this.proyectoModel
      .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
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

  async agregarDocumento(id: string, dto: AgregarDocumentoProyectoDto, usuarioId?: string) {
    const nuevoDoc: any = { ...dto, subido_en: new Date() };
    if (usuarioId) nuevoDoc.subido_por = new Types.ObjectId(usuarioId);
    const proyecto = await this.proyectoModel
      .findByIdAndUpdate(id, { $push: { documentos: nuevoDoc } }, { new: true })
      .lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return proyecto.documentos[proyecto.documentos.length - 1];
  }

  async eliminarDocumento(proyectoId: string, docId: string) {
    const proyecto = await this.proyectoModel
      .findByIdAndUpdate(
        proyectoId,
        { $pull: { documentos: { _id: new Types.ObjectId(docId) } } },
        { new: true },
      )
      .lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    return { message: 'Documento eliminado', docId };
  }
}
