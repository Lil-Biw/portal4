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

  async findAll(): Promise<object[]> {
    const noticias = await this.noticiaModel
      .find({ activo: true })
      .sort({ creado_en: -1 })
      .select('-imagen_data')
      .lean();
    return noticias.map(n => ({
      ...n,
      imagen_url: n.imagen_mimetype ? `/api/v1/noticias/${n._id}/imagen` : '',
    }));
  }

  async create(dto: CreateNoticiaDto) {
    return new this.noticiaModel(dto).save();
  }

  async update(id: string, dto: CreateNoticiaDto) {
    const actualizada = await this.noticiaModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean();
    if (!actualizada) throw new NotFoundException(`Noticia ${id} no encontrada`);
    return actualizada;
  }

  private async notificarTodosLosUsuarios(noticia: {
    titulo: string; resumen: string; enlace: string; seccion: string;
    imagenBuffer?: Buffer; imagenMimetype?: string;
  }) {
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
          titulo:         noticia.titulo,
          resumen:        noticia.resumen,
          enlace:         noticia.enlace,
          seccion:        noticia.seccion,
          imagenBuffer:   noticia.imagenBuffer,
          imagenMimetype: noticia.imagenMimetype,
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

    const actualizada = await this.noticiaModel
      .findByIdAndUpdate(
        id,
        { imagen_url, imagen_data: archivo.buffer, imagen_mimetype: mimetype },
        { new: true },
      )
      .lean();

    void this.notificarTodosLosUsuarios({
      titulo:         noticia.titulo,
      resumen:        noticia.resumen,
      enlace:         noticia.enlace,
      seccion:        noticia.seccion,
      imagenBuffer:   archivo.buffer,
      imagenMimetype: archivo.mimetype || 'image/jpeg',
    });

    return actualizada;
  }

  async findOne(id: string) {
    const noticia = await this.noticiaModel.findById(id).lean();
    if (!noticia) throw new NotFoundException(`Noticia ${id} no encontrada`);
    return noticia;
  }

  async getImagen(id: string): Promise<{ data: Buffer; mimetype: string }> {
    const noticia = await this.noticiaModel.findById(id).select('imagen_data imagen_mimetype').lean();
    if (!noticia || !noticia.imagen_data) throw new NotFoundException(`Imagen de noticia ${id} no encontrada`);
    const raw = noticia.imagen_data as unknown;
    let data: Buffer;
    if (Buffer.isBuffer(raw)) {
      data = raw;
    } else if (raw && typeof raw === 'object' && 'buffer' in (raw as object)) {
      const buf = (raw as { buffer: Buffer | ArrayBuffer }).buffer;
      data = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    } else {
      data = Buffer.from(raw as ArrayBuffer);
    }
    return { data, mimetype: noticia.imagen_mimetype || 'image/jpeg' };
  }

  async remove(id: string) {
    const noticia = await this.noticiaModel.findByIdAndDelete(id).lean();
    if (!noticia) throw new NotFoundException(`Noticia ${id} no encontrada`);
    return { message: 'Noticia eliminada', id };
  }
}
