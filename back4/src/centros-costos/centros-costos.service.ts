import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CentroCostoDocument } from './centros-costos.schema';
import { CreateCentroCostoDto, UpdateCentroCostoDto } from './centros-costos.dto';
import { DocumentosHelper, DocumentoInput, resolverSubidoPorNombre } from '../common/helpers/documentos.helper';
import { notificarDocumentoSubido, condicionSuscripcionAdmin } from '../common/helpers/notificar-documento.helper';
import { DocumentosVencidosService } from '../documentos-vencidos/documentos-vencidos.service';
import { MailService } from '../mail/mail.service';
import { ContextoJerarquico } from '../mail/templates/jerarquia';
import { NotificacionOpcionesDto } from '../common/dto/notificacion-opciones.dto';
import { S3Service } from '../common/s3/s3.service';

@Injectable()
export class CentrosCostosService {
  private readonly docsHelper: DocumentosHelper;
  private readonly logger = new Logger(CentrosCostosService.name);

  constructor(
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
    @InjectModel('DocCentroCosto') private docCentroCostoModel: Model<any>,
    @InjectModel('DocEliminado') private docEliminadoModel: Model<any>,
    @InjectModel('Usuario') private readonly usuarioModel: Model<{ nombre: string; email: string; rol: string; cliente_id: Types.ObjectId; centros_asignados: Types.ObjectId[]; activo: boolean }>,
    private readonly documentosVencidosService: DocumentosVencidosService,
    private readonly mailService: MailService,
    private readonly s3Service: S3Service,
  ) {
    this.docsHelper = new DocumentosHelper(
      centroCostoModel,
      docCentroCostoModel,
      'centro_costo_id',
      docEliminadoModel,
      'centro',
      'Centro de costos',
      s3Service,
    );
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
      this.centroCostoModel.find(filter).select('-foto.contenido').sort({ nombre: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.centroCostoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findAllByCliente(cliente_id: string, page = 1, limit = 20) {
    const filter = { cliente_id: new Types.ObjectId(cliente_id), activo: true };
    const [data, total] = await Promise.all([
      this.centroCostoModel.find(filter).select('-foto.contenido').sort({ nombre: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.centroCostoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findByIds(ids: string[]) {
    return this.centroCostoModel
      .find({ _id: { $in: ids.map(id => new Types.ObjectId(id)) }, activo: true })
      .select('-foto.contenido')
      .lean();
  }

  async findOne(id: string) {
    const centro = await this.centroCostoModel.findById(id).select('-foto.contenido').lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return centro;
  }

  async update(id: string, dto: UpdateCentroCostoDto) {
    const payload: Record<string, unknown> = { ...dto };
    if (dto.cliente_id) payload['cliente_id'] = this.toObjectId(dto.cliente_id);
    const centro = await this.centroCostoModel
      .findByIdAndUpdate(id, payload, { new: true })
      .select('-foto.contenido')
      .lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return centro;
  }

  async remove(id: string) {
    const centro = await this.centroCostoModel
      .findByIdAndUpdate(id, { activo: false }, { new: true })
      .select('-foto.contenido')
      .lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return { message: 'Centro desactivado', id };
  }

  async updateScoreSmartclarity(centroId: string, valores: number[]) {
    const centro = await this.centroCostoModel
      .findByIdAndUpdate(centroId, { score_smartclarity: valores }, { new: true, runValidators: true })
      .select('-foto.contenido')
      .lean();
    if (!centro) throw new NotFoundException(`Centro ${centroId} no encontrado`);
    return centro;
  }

  async subirFoto(id: string, archivo: { originalname: string; buffer: Buffer; mimetype: string }) {
    const centro = await this.centroCostoModel.findById(id).lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return this.centroCostoModel
      .findByIdAndUpdate(
        id,
        { foto: { contenido: archivo.buffer, tipo_mime: archivo.mimetype, nombre: archivo.originalname } },
        { new: true, runValidators: false },
      )
      .select('-foto.contenido')
      .lean();
  }

  async servirFoto(id: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre: string }> {
    const centro = await this.centroCostoModel.findById(id).select('foto').lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    if (!centro.foto?.contenido) throw new NotFoundException('Este centro no tiene foto');
    const raw = centro.foto.contenido as unknown;
    let buffer: Buffer;
    if (Buffer.isBuffer(raw)) {
      buffer = raw;
    } else if (raw && typeof raw === 'object' && 'buffer' in (raw as object)) {
      const buf = (raw as { buffer: Buffer | ArrayBuffer }).buffer;
      buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    } else {
      buffer = Buffer.from(raw as ArrayBuffer);
    }
    return { buffer, tipo_mime: centro.foto.tipo_mime, nombre: centro.foto.nombre };
  }

  async agregarDocumento(id: string, input: DocumentoInput, nombreDisplay?: string, categoria?: string, usuarioId?: string, rolUploader?: string) {
    const result = await this.docsHelper.agregar(id, input, nombreDisplay, categoria, usuarioId);
    if (rolUploader === 'usuario') {
      this.notificarSubidaDocumento(id, result['nombre_display'] as string, result['categoria'] as string | undefined, usuarioId)
        .catch((err: unknown) => this.logger.error('Error al notificar subida de documento (centro):', err));
    }
    return result;
  }

  private async notificarSubidaDocumento(centroId: string, nombre: string, categoria?: string, usuarioId?: string): Promise<void> {
    const centro = await this.centroCostoModel
      .findById(centroId)
      .select('nombre cliente_id')
      .populate('cliente_id', 'razon_social')
      .lean() as any;
    if (!centro) return;
    const empresaId = centro.cliente_id?._id ?? centro.cliente_id;
    const empresaNombre = centro.cliente_id?.razon_social ?? 'Empresa';
    await notificarDocumentoSubido({
      jerarquia: { empresa: empresaNombre, centro: centro.nombre },
      nombre,
      categoria: categoria ?? 'Sin categoría',
      usuarioId,
      usuarioModel: this.usuarioModel as any,
      mailService: this.mailService,
      logger: this.logger,
      scope: { tipo: 'centro', empresaId: String(empresaId), centroId },
    });
  }

  async listarDocumentos(id: string) {
    const docs = await this.docsHelper.listar(id);
    return resolverSubidoPorNombre(docs, this.usuarioModel as any);
  }

  async actualizarDocumento(id: string, docId: string, categoria: string) {
    const doc = await this.docsHelper.actualizarCategoria(id, docId, categoria);
    const [conNombre] = await resolverSubidoPorNombre([doc], this.usuarioModel as any);
    return conNombre;
  }

  servirDocumento(centroId: string, docId: string) {
    return this.docsHelper.servir(centroId, docId);
  }

  eliminarDocumento(centroId: string, docId: string) {
    return this.docsHelper.eliminar(centroId, docId);
  }

  async vencerDocumento(
    centroId: string, docId: string,
    empresaId?: string, empresaNombre?: string, centroNombre?: string,
    notificacion?: NotificacionOpcionesDto,
  ) {
    const centro = await this.centroCostoModel
      .findById(centroId)
      .populate('cliente_id', 'razon_social')
      .lean() as any;
    if (!centro) throw new NotFoundException(`Centro ${centroId} no encontrado`);

    const doc = await this.docCentroCostoModel.findOne({
      _id: new Types.ObjectId(docId),
      centro_costo_id: new Types.ObjectId(centroId),
    });
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

    const empresaIdObj = centro.cliente_id?._id ?? centro.cliente_id;
    const resolvedEmpresaId = empresaId ?? String(empresaIdObj);
    const empresaNombreReal = centro.cliente_id?.razon_social ?? empresaNombre ?? 'Empresa';

    await this.documentosVencidosService.crear({
      nombre_display: doc.nombre_display,
      categoria:      doc.categoria,
      tipo_contenido: doc.tipo_contenido as 'archivo' | 'link' | undefined,
      link_url:       doc.link_url,
      tipo_mime:      doc.tipo_mime,
      tamano_bytes:   doc.tamano_bytes,
      contenido:      doc.contenido,
      s3_key:         doc.s3_key,
      subido_por:     doc.subido_por,
      origen_tipo:    'centro',
      empresa_id:     resolvedEmpresaId,
      centro_id:      centroId,
      empresa_nombre: empresaNombre,
      centro_nombre:  centroNombre,
      subido_en:      doc.subido_en,
    });

    await this.docCentroCostoModel.deleteOne({ _id: doc._id });

    void this.notificarVencimiento(
      resolvedEmpresaId,
      centroId,
      doc.nombre_display as string,
      doc.categoria as string,
      { empresa: empresaNombreReal, centro: centro.nombre },
      notificacion,
    );

    return { message: 'Documento marcado como vencido', docId };
  }

  private async notificarVencimiento(
    empresaIdStr: string,
    centroId: string,
    nombreDoc: string,
    categoria: string,
    jerarquia: ContextoJerarquico,
    notificacion?: NotificacionOpcionesDto,
  ): Promise<void> {
    if (!notificacion?.notificar) return;

    try {
      const empresaId = new Types.ObjectId(empresaIdStr);
      const centroObjId = new Types.ObjectId(centroId);

      let usuariosDestino: { nombre: string; email: string }[] = [];

      if (notificacion.audiencia === 'especificos') {
        usuariosDestino = await this.usuarioModel
          .find({
            _id: { $in: (notificacion.destinatarios_ids ?? []).map(id => new Types.ObjectId(id)) },
            activo: true,
            $or: [{ cliente_id: empresaId }, { rol: 'admin_smartclarity' }],
          })
          .select('nombre email')
          .lean();
      } else {
        usuariosDestino = await this.usuarioModel
          .find({
            activo: true,
            $or: [
              { rol: 'admin_smartclarity', $or: condicionSuscripcionAdmin({ empresaId, centroId: centroObjId }) },
              { cliente_id: empresaId, centros_asignados: centroObjId },
            ],
          })
          .select('nombre email')
          .lean();
      }

      const superAdmins = notificacion.notificar_super_admins
        ? await this.usuarioModel.find({ rol: 'super_admin', activo: true }).select('nombre email').lean()
        : [];

      const vistos = new Set<string>();
      const destinatarios: { nombre: string; email: string }[] = [];
      for (const u of [...usuariosDestino, ...superAdmins]) {
        if (u.email && !vistos.has(u.email)) {
          vistos.add(u.email);
          destinatarios.push({ nombre: u.nombre, email: u.email });
        }
      }

      if (destinatarios.length === 0) return;

      await this.mailService.notificarDocumentoVencido({
        destinatarios,
        documento: { nombre: nombreDoc, categoria, jerarquia },
      });
    } catch (err: unknown) {
      this.logger.error('Error al notificar vencimiento de documento:', err);
    }
  }
}
