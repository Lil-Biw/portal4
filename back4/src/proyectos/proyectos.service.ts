import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProyectoDocument } from './proyectos.schema';
import { CreateProyectoDto, UpdateProyectoDto } from './proyectos.dto';
import { DocumentosHelper, ArchivoInput } from '../common/helpers/documentos.helper';
import { notificarDocumentoSubido } from '../common/helpers/notificar-documento.helper';
import { DocumentosVencidosService } from '../documentos-vencidos/documentos-vencidos.service';
import { MailService } from '../mail/mail.service';
import { NotificacionOpcionesDto } from '../common/dto/notificacion-opciones.dto';
import { S3Service } from '../common/s3/s3.service';

@Injectable()
export class ProyectosService {
  private readonly docsHelper: DocumentosHelper;
  private readonly logger = new Logger(ProyectosService.name);

  constructor(
    @InjectModel('Proyecto') private proyectoModel: Model<ProyectoDocument>,
    @InjectModel('DocProyecto') private docProyectoModel: Model<any>,
    @InjectModel('DocEliminado') private docEliminadoModel: Model<any>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<any>,
    @InjectModel('Usuario') private readonly usuarioModel: Model<{ nombre: string; email: string; rol: string; cliente_id: Types.ObjectId; centros_asignados: Types.ObjectId[]; activo: boolean }>,
    private readonly documentosVencidosService: DocumentosVencidosService,
    private readonly mailService: MailService,
    private readonly s3Service: S3Service,
  ) {
    this.docsHelper = new DocumentosHelper(
      proyectoModel,
      docProyectoModel,
      'proyecto_id',
      docEliminadoModel,
      'proyecto',
      'Proyecto',
      s3Service,
    );
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
      tipo_proyecto_id: dto.tipo_proyecto_id ? this.toObjectId(dto.tipo_proyecto_id) : undefined,
      fecha_inicio: dto.fecha_inicio ? new Date(dto.fecha_inicio) : undefined,
      fecha_fin: dto.fecha_fin ? new Date(dto.fecha_fin) : undefined,
    };
    if (creadoPor) doc['creado_por'] = new Types.ObjectId(creadoPor);
    const proyecto = await new this.proyectoModel(doc).save();
    return proyecto.populate('tipo_proyecto_id');
  }

  async findAll(page = 1, limit = 20, estado?: string) {
    const filter = estado ? { estado } : { estado: { $ne: 'cerrado' } };
    const [data, total] = await Promise.all([
      this.proyectoModel.find(filter).populate('tipo_proyecto_id').sort({ nombre: 1 }).skip((page - 1) * limit).limit(limit).lean(),
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
      this.proyectoModel.find(filter).populate('tipo_proyecto_id').sort({ nombre: 1 }).skip((page - 1) * limit).limit(limit).lean(),
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
      this.proyectoModel.find(filter).populate('tipo_proyecto_id').sort({ nombre: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.proyectoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const proyecto = await this.proyectoModel.findById(id).populate('tipo_proyecto_id').lean();
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
    if (dto.tipo_proyecto_id) payload['tipo_proyecto_id'] = this.toObjectId(dto.tipo_proyecto_id);
    const proyecto = await this.proyectoModel
      .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
      .populate('tipo_proyecto_id')
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

  async agregarDocumento(id: string, archivo: ArchivoInput, nombreDisplay?: string, categoria?: string, usuarioId?: string, rolUploader?: string) {
    const result = await this.docsHelper.agregar(id, archivo, nombreDisplay, categoria, usuarioId);
    if (rolUploader === 'usuario') {
      this.notificarSubidaDocumento(id, result['nombre_display'] as string, result['categoria'] as string | undefined, usuarioId)
        .catch((err: unknown) => this.logger.error('Error al notificar subida de documento (proyecto):', err));
    }
    return result;
  }

  private async notificarSubidaDocumento(proyectoId: string, nombre: string, categoria?: string, usuarioId?: string): Promise<void> {
    const proyecto = await this.proyectoModel.findById(proyectoId).select('nombre').lean() as any;
    const contexto = proyecto ? `Proyecto: ${proyecto.nombre}` : 'Proyecto';
    await notificarDocumentoSubido({
      contexto,
      nombre,
      categoria: categoria ?? 'Sin categoría',
      usuarioId,
      usuarioModel: this.usuarioModel as any,
      mailService: this.mailService,
      logger: this.logger,
    });
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
    notificacion?: NotificacionOpcionesDto,
  ) {
    const proyecto = await this.proyectoModel.findById(proyectoId).lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);

    const doc = await this.docProyectoModel.findOne({
      _id: new Types.ObjectId(docId),
      proyecto_id: new Types.ObjectId(proyectoId),
    });
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

    await this.documentosVencidosService.crear({
      nombre_display:  doc.nombre_display,
      categoria:       doc.categoria,
      tipo_mime:       doc.tipo_mime,
      tamano_bytes:    doc.tamano_bytes,
      contenido:       doc.contenido,
      s3_key:          doc.s3_key,
      origen_tipo:     'proyecto',
      empresa_id:      empresaId,
      centro_id:       centroId,
      proyecto_id:     proyectoId,
      empresa_nombre:  empresaNombre,
      centro_nombre:   centroNombre,
      proyecto_nombre: proyectoNombre,
      subido_en:       doc.subido_en,
    });

    await this.docProyectoModel.deleteOne({ _id: doc._id });

    void this.notificarVencimiento(
      empresaId,
      centroId,
      doc.nombre_display as string,
      doc.categoria as string,
      proyectoNombre ?? centroNombre ?? 'proyecto',
      notificacion,
    );

    return { message: 'Documento marcado como vencido', docId };
  }

  private async notificarVencimiento(
    empresaIdStr: string,
    centroId: string,
    nombreDoc: string,
    categoria: string,
    contextoLabel: string,
    notificacion?: NotificacionOpcionesDto,
  ): Promise<void> {
    if (!notificacion?.notificar) return;

    try {
      const empresaId  = new Types.ObjectId(empresaIdStr);
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
              { rol: 'admin_smartclarity' },
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
        documento: { nombre: nombreDoc, categoria, contexto: contextoLabel },
      });
    } catch (err: unknown) {
      this.logger.error('Error al notificar vencimiento de documento:', err);
    }
  }
}
