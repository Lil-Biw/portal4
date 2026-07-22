import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClienteDocument } from './clientes.schema';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';
import { DocumentosHelper, DocumentoInput, resolverSubidoPorNombre } from '../common/helpers/documentos.helper';
import { DocumentosVencidosService } from '../documentos-vencidos/documentos-vencidos.service';
import { notificarDocumentoSubido, condicionSuscripcionAdmin } from '../common/helpers/notificar-documento.helper';
import { MailService } from '../mail/mail.service';
import { ContextoJerarquico } from '../mail/templates/jerarquia';
import { NotificacionOpcionesDto } from '../common/dto/notificacion-opciones.dto';
import { S3Service } from '../common/s3/s3.service';

@Injectable()
export class ClientesService {
  private readonly docsHelper: DocumentosHelper;
  private readonly logger = new Logger(ClientesService.name);

  constructor(
    @InjectModel('Cliente') private clienteModel: Model<ClienteDocument>,
    @InjectModel('DocCliente') private docClienteModel: Model<any>,
    @InjectModel('DocEliminado') private docEliminadoModel: Model<any>,
    @InjectModel('Usuario') private readonly usuarioModel: Model<{ nombre: string; email: string; rol: string; activo: boolean }>,
    private readonly documentosVencidosService: DocumentosVencidosService,
    private readonly mailService: MailService,
    private readonly s3Service: S3Service,
  ) {
    this.docsHelper = new DocumentosHelper(
      clienteModel,
      docClienteModel,
      'cliente_id',
      docEliminadoModel,
      'empresa',
      'Cliente',
      s3Service,
    );
  }

  async create(dto: CreateClienteDto) {
    const existe = await this.clienteModel.findOne({ rut: dto.rut });
    if (existe) throw new ConflictException(`Ya existe un cliente con RUT ${dto.rut}`);
    const cliente = new this.clienteModel(dto);
    return cliente.save();
  }

  async findAll(page = 1, limit = 20, soloActivos = true) {
    const filter = soloActivos ? { activo: true } : {};
    const [data, total] = await Promise.all([
      this.clienteModel.find(filter).select('-logo.contenido').sort({ razon_social: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.clienteModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const cliente = await this.clienteModel.findById(id).select('-logo.contenido').lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async update(id: string, dto: UpdateClienteDto) {
    const cliente = await this.clienteModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .select('-logo.contenido')
      .lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async remove(id: string) {
    const cliente = await this.clienteModel
      .findByIdAndUpdate(id, { activo: false }, { new: true })
      .lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return { message: 'Cliente desactivado correctamente', id };
  }

  async updateScoreSmartclarity(id: string, valores: number[]) {
    const cliente = await this.clienteModel
      .findByIdAndUpdate(id, { score_smartclarity: valores }, { new: true, runValidators: true })
      .select('-logo.contenido')
      .lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async updateConfigGrafico(id: string, mostrarPromedio: boolean) {
    const cliente = await this.clienteModel
      .findByIdAndUpdate(id, { mostrar_grafico_promedio: mostrarPromedio }, { new: true, runValidators: true })
      .select('-logo.contenido')
      .lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async subirLogo(id: string, archivo: { originalname: string; buffer: Buffer; mimetype: string }) {
    const cliente = await this.clienteModel.findById(id).lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return this.clienteModel
      .findByIdAndUpdate(
        id,
        { logo: { contenido: archivo.buffer, tipo_mime: archivo.mimetype, nombre: archivo.originalname } },
        { new: true, runValidators: false },
      )
      .select('-logo.contenido')
      .lean();
  }

  async servirLogo(id: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre: string }> {
    const cliente = await this.clienteModel.findById(id).select('logo').lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    if (!cliente.logo?.contenido) throw new NotFoundException('Este cliente no tiene logo');
    const raw = cliente.logo.contenido as unknown;
    let buffer: Buffer;
    if (Buffer.isBuffer(raw)) {
      buffer = raw;
    } else if (raw && typeof raw === 'object' && 'buffer' in (raw as object)) {
      const buf = (raw as { buffer: Buffer | ArrayBuffer }).buffer;
      buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    } else {
      buffer = Buffer.from(raw as ArrayBuffer);
    }
    return { buffer, tipo_mime: cliente.logo.tipo_mime, nombre: cliente.logo.nombre };
  }

  async agregarDocumento(id: string, input: DocumentoInput, nombreDisplay?: string, categoria?: string, rolUploader?: string, usuarioId?: string) {
    const result = await this.docsHelper.agregar(id, input, nombreDisplay, categoria, usuarioId);
    if (rolUploader === 'usuario') {
      const cliente = await this.clienteModel.findById(id).select('razon_social').lean() as any;
      notificarDocumentoSubido({
        jerarquia: { empresa: cliente ? cliente.razon_social : 'Empresa' },
        nombre: result['nombre_display'] as string,
        categoria: (result['categoria'] as string) ?? 'Sin categoría',
        usuarioId,
        usuarioModel: this.usuarioModel as any,
        mailService: this.mailService,
        logger: this.logger,
        scope: { tipo: 'empresa', empresaId: id },
      }).catch((err: unknown) => this.logger.error('Error al notificar subida de documento (empresa):', err));
    }
    return result;
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

  servirDocumento(clienteId: string, docId: string) {
    return this.docsHelper.servir(clienteId, docId);
  }

  eliminarDocumento(clienteId: string, docId: string) {
    return this.docsHelper.eliminar(clienteId, docId);
  }

  async vencerDocumento(clienteId: string, docId: string, empresaNombre?: string, notificacion?: NotificacionOpcionesDto) {
    const cliente = await this.clienteModel.findById(clienteId).lean();
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);

    const doc = await this.docClienteModel.findOne({
      _id: new Types.ObjectId(docId),
      cliente_id: new Types.ObjectId(clienteId),
    });
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

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
      origen_tipo:    'empresa',
      empresa_id:     clienteId,
      empresa_nombre: empresaNombre,
      subido_en:      doc.subido_en,
    });

    await this.docClienteModel.deleteOne({ _id: doc._id });

    void this.notificarVencimiento(
      clienteId,
      doc.nombre_display as string,
      doc.categoria as string,
      { empresa: cliente.razon_social ?? empresaNombre ?? 'Empresa' },
      notificacion,
    );

    return { message: 'Documento marcado como vencido', docId };
  }

  private async notificarVencimiento(
    clienteId: string,
    nombreDoc: string,
    categoria: string,
    jerarquia: ContextoJerarquico,
    notificacion?: NotificacionOpcionesDto,
  ): Promise<void> {
    if (!notificacion?.notificar) return;

    try {
      const empresaId = new Types.ObjectId(clienteId);
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
              { rol: 'admin_smartclarity', $or: condicionSuscripcionAdmin({ empresaId }) },
              { cliente_id: empresaId },
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
        if ((u as any).email && !vistos.has((u as any).email)) {
          vistos.add((u as any).email);
          destinatarios.push({ nombre: (u as any).nombre, email: (u as any).email });
        }
      }

      if (destinatarios.length === 0) return;

      await this.mailService.notificarDocumentoVencido({
        destinatarios,
        documento: { nombre: nombreDoc, categoria, jerarquia },
      });
    } catch (err: unknown) {
      this.logger.error('Error al notificar vencimiento de documento (empresa):', err);
    }
  }
}
