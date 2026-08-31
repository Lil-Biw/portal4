import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activo, ActivoDocument } from './activos.schema';
import { CreateActivoDto, UpdateActivoDto } from './activos.dto';
import { CentroCostoDocument } from '../centros-costos/centros-costos.schema';
import { DocumentosHelper, DocumentoInput } from '../common/helpers/documentos.helper';
import { S3Service } from '../common/s3/s3.service';

@Injectable()
export class ActivosService {
  private readonly docsHelper: DocumentosHelper;

  constructor(
    @InjectModel('Activo') private activoModel: Model<ActivoDocument>,
    @InjectModel('DocActivo') private docActivoModel: Model<any>,
    @InjectModel('DocEliminado') private docEliminadoModel: Model<any>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
    @InjectModel('TipoActivo') private tipoActivoModel: Model<any>,
    private readonly s3Service: S3Service,
  ) {
    this.docsHelper = new DocumentosHelper(
      activoModel,
      docActivoModel,
      'activo_id',
      docEliminadoModel,
      'activo',
      'Activo',
      s3Service,
    );
  }

  async findAll(centroCostoId?: string) {
    const filter: Record<string, unknown> = { activo: true };
    if (centroCostoId) {
      filter['centro_costo_id'] = {
        $in: [centroCostoId, new Types.ObjectId(centroCostoId)],
      };
    }
    return this.activoModel.find(filter).populate('tipo_activo_id').sort({ nombre: 1 }).lean();
  }

  async findAllByEmpresa(empresaId: string, centroCostoId?: string) {
    const centros = await this.centroCostoModel
      .find({ cliente_id: new Types.ObjectId(empresaId), activo: true })
      .select('_id')
      .lean();
    const centroIds = centros.map((c) => c._id);
    const filter: Record<string, unknown> = {
      activo: true,
      centro_costo_id: { $in: centroIds },
    };
    if (centroCostoId) {
      filter['centro_costo_id'] = {
        $in: [
          ...centroIds,
          new Types.ObjectId(centroCostoId),
          centroCostoId,
        ],
      };
    }
    return this.activoModel.find(filter).populate('tipo_activo_id').sort({ nombre: 1 }).lean();
  }

  async findOne(id: string) {
    const activo = await this.activoModel.findById(id).populate('tipo_activo_id').lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return activo;
  }

  async create(dto: CreateActivoDto) {
    const activo = new this.activoModel({
      ...dto,
      tipo_activo_id: new Types.ObjectId(dto.tipo_activo_id),
      centro_costo_id: new Types.ObjectId(dto.centro_costo_id),
    });
    return activo.save();
  }

  async update(id: string, dto: UpdateActivoDto) {
    const updateData: Record<string, unknown> = { ...dto };
    if (dto.tipo_activo_id) updateData['tipo_activo_id'] = new Types.ObjectId(dto.tipo_activo_id);
    const activo = await this.activoModel
      .findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate('tipo_activo_id')
      .lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return activo;
  }

  async remove(id: string) {
    const activo = await this.activoModel
      .findByIdAndUpdate(id, { activo: false }, { new: true })
      .lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return { message: 'Activo desactivado correctamente', id };
  }

  listarDocumentos(activoId: string) {
    return this.docsHelper.listar(activoId);
  }

  subirDocumento(activoId: string, input: DocumentoInput, nombreDisplay?: string, categoria?: string) {
    return this.docsHelper.agregar(activoId, input, nombreDisplay, categoria);
  }

  actualizarCategoria(activoId: string, docId: string, categoria: string) {
    return this.docsHelper.actualizarCategoria(activoId, docId, categoria);
  }

  servirDocumento(activoId: string, docId: string) {
    return this.docsHelper.servir(activoId, docId);
  }

  eliminarDocumento(activoId: string, docId: string) {
    return this.docsHelper.eliminar(activoId, docId);
  }

  renombrarDocumento(activoId: string, docId: string, nombreDisplay: string) {
    return this.docsHelper.renombrar(activoId, docId, nombreDisplay);
  }
}
