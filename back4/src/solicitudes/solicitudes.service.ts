import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { SolicitudDocument } from './solicitudes.schema';
import { CentroCostoDocument } from '../centros-costos/centros-costos.schema';
import { CreateSolicitudDto, UpdateSolicitudDto, CambiarEstadoDto } from './solicitudes.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class SolicitudesService {
  private readonly logger = new Logger(SolicitudesService.name);

  constructor(
    @InjectModel('Solicitud') private solicitudModel: Model<SolicitudDocument>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
    @InjectModel('Usuario') private usuarioModel: Model<{ nombre: string; email: string; cliente_id: Types.ObjectId; activo: boolean }>,
    private mailService: MailService,
  ) {}

  async create(dto: CreateSolicitudDto) {
    const doc: Record<string, unknown> = {
      ...dto,
      empresa_id: new Types.ObjectId(dto.empresa_id),
    };
    if (dto.centro_costo_id) doc['centro_costo_id'] = new Types.ObjectId(dto.centro_costo_id);
    if (dto.proyecto_id)     doc['proyecto_id']     = new Types.ObjectId(dto.proyecto_id);
    const saved = await new this.solicitudModel(doc).save();

    // Notificar solo si la solicitud tiene centro de costos asignado
    if (dto.centro_costo_id) {
      await this.notificarUsuariosCentro(dto.centro_costo_id, dto);
    }

    return saved;
  }

  private async notificarUsuariosCentro(centroCostoId: string, dto: CreateSolicitudDto) {
    try {
      const centro = await this.centroCostoModel.findById(centroCostoId).lean();
      if (!centro) return;

      const usuarios = await this.usuarioModel
        .find({ cliente_id: new Types.ObjectId(String(centro.cliente_id)), activo: true })
        .select('nombre email')
        .lean();

      this.logger.log(`Notificación solicitud: centro=${centroCostoId} usuarios=${usuarios.length}`);

      const destinatarios = usuarios.filter(u => u.email);
      if (destinatarios.length === 0) return;

      await this.mailService.notificarNuevaSolicitud({
        destinatarios,
        solicitud: {
          nombre:      dto.nombre,
          tipo:        dto.tipo,
          descripcion: dto.descripcion,
          centro:      String(centro.nombre),
        },
      });
      this.logger.log(`Correos de solicitud enviados a ${destinatarios.length} usuario(s)`);
    } catch (err: unknown) {
      this.logger.error('Error al notificar solicitud:', err);
    }
  }

  async findByContexto(empresaId: string, centroId?: string, proyectoId?: string, estado?: string) {
    const filter: any = { empresa_id: new Types.ObjectId(empresaId) };
    if (centroId)   filter.centro_costo_id = new Types.ObjectId(centroId);
    if (proyectoId) filter.proyecto_id     = new Types.ObjectId(proyectoId);
    if (estado)     filter.estado      = estado;
    return this.solicitudModel.find(filter).sort({ creado_en: -1 }).lean();
  }

  async update(id: string, dto: UpdateSolicitudDto) {
    const solicitud = await this.solicitudModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    return solicitud;
  }

  async remove(id: string) {
    const solicitud = await this.solicitudModel.findById(id).lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    // Eliminar archivos adjuntos si existen
    const dir = path.join(process.cwd(), 'uploads', 'solicitudes', id);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    await this.solicitudModel.findByIdAndDelete(id);
    return { deleted: true };
  }

  async cambiarEstado(id: string, dto: CambiarEstadoDto) {
    const solicitud = await this.solicitudModel
      .findByIdAndUpdate(id, { estado: dto.estado }, { new: true })
      .lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    return solicitud;
  }

  async adjuntarArchivo(id: string, archivo: { originalname: string; buffer: Buffer; mimetype: string }) {
    const solicitud = await this.solicitudModel.findById(id).lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);

    if (!['pendiente', 'rechazado', 'vencido'].includes(solicitud.estado)) {
      throw new BadRequestException(`No se puede adjuntar un archivo a una solicitud en estado "${solicitud.estado}"`);
    }

    const TIPOS_PERMITIDOS = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!TIPOS_PERMITIDOS.includes(archivo.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido. Se aceptan PDF, imágenes, Word y Excel.');
    }

    const dir = path.join(process.cwd(), 'uploads', 'solicitudes', id);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Eliminar archivo previo si existe
    for (const f of fs.readdirSync(dir)) {
      fs.unlinkSync(path.join(dir, f));
    }

    const ext = path.extname(archivo.originalname) || '';
    const filename = `adjunto${ext}`;
    fs.writeFileSync(path.join(dir, filename), archivo.buffer);

    const archivo_url    = `/uploads/solicitudes/${id}/${filename}`;
    const archivo_nombre = archivo.originalname;

    return this.solicitudModel
      .findByIdAndUpdate(id, { archivo_url, archivo_nombre, estado: 'revision' }, { new: true })
      .lean();
  }
}
