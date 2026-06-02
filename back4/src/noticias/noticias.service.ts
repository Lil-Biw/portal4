import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Noticia, NoticiaDocument } from './noticias.schema';
import { CreateNoticiaDto } from './noticias.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NoticiasService {
  private readonly logger = new Logger(NoticiasService.name);

  constructor(
    @InjectModel('Noticia') private noticiaModel: Model<NoticiaDocument>,
    @InjectModel('Usuario') private usuarioModel: Model<{ nombre: string; email: string; activo: boolean }>,
    private mailService: MailService,
  ) {}

  findAll() {
    return this.noticiaModel.find({ activo: true }).sort({ creado_en: -1 }).lean();
  }

  async create(dto: CreateNoticiaDto) {
    const noticia = await new this.noticiaModel(dto).save();
    void this.notificarTodosLosUsuarios(noticia);
    return noticia;
  }

  private async notificarTodosLosUsuarios(noticia: Noticia & { _id: unknown; enlace: string }) {
    try {
      const usuarios = await this.usuarioModel
        .find({ activo: true })
        .select('nombre email')
        .lean();

      const destinatarios = usuarios.filter(u => u.email);
      if (destinatarios.length === 0) return;

      this.logger.log(`Notificación de noticia: ${destinatarios.length} destinatario(s)`);

      await this.mailService.notificarNuevaNoticia({
        destinatarios,
        noticia: {
          titulo:  noticia.titulo,
          resumen: noticia.resumen,
          enlace:  noticia.enlace,
          seccion: noticia.seccion,
        },
      });
    } catch (err: unknown) {
      this.logger.error('Error al notificar noticia:', err);
    }
  }

  async subirImagen(id: string, archivo: { originalname: string; buffer: Buffer; mimetype: string }) {
    const noticia = await this.noticiaModel.findById(id).lean();
    if (!noticia) throw new NotFoundException(`Noticia ${id} no encontrada`);

    const mimetype = archivo.mimetype || 'image/jpeg';
    const imagen_url = `/api/v1/noticias/${id}/imagen`;

    return this.noticiaModel
      .findByIdAndUpdate(
        id,
        { imagen_url, imagen_data: archivo.buffer, imagen_mimetype: mimetype },
        { new: true },
      )
      .lean();
  }

  async findOne(id: string) {
    const noticia = await this.noticiaModel.findById(id).lean();
    if (!noticia) throw new NotFoundException(`Noticia ${id} no encontrada`);
    return noticia;
  }

  async getImagen(id: string): Promise<{ data: Buffer; mimetype: string }> {
    const noticia = await this.noticiaModel.findById(id).select('imagen_data imagen_mimetype').exec();
    if (!noticia || !noticia.imagen_data) throw new NotFoundException(`Imagen de noticia ${id} no encontrada`);
    const raw = noticia.imagen_data as unknown;
    const data = Buffer.isBuffer(raw) ? raw : Buffer.from((raw as { buffer: ArrayBuffer }).buffer);
    return { data, mimetype: noticia.imagen_mimetype || 'image/jpeg' };
  }

  async remove(id: string) {
    const noticia = await this.noticiaModel.findByIdAndDelete(id).lean();
    if (!noticia) throw new NotFoundException(`Noticia ${id} no encontrada`);
    return { message: 'Noticia eliminada', id };
  }
}
