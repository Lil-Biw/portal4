import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Noticia, NoticiaDocument } from './noticias.schema';
import { CreateNoticiaDto } from './noticias.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class NoticiasService {
  constructor(@InjectModel('Noticia') private noticiaModel: Model<NoticiaDocument>) {}

  findAll() {
    return this.noticiaModel.find({ activo: true }).sort({ creado_en: -1 }).lean();
  }

  async create(dto: CreateNoticiaDto) {
    const noticia = new this.noticiaModel(dto);
    return noticia.save();
  }

  async subirImagen(id: string, archivo: { originalname: string; buffer: Buffer }) {
    const noticia = await this.noticiaModel.findById(id).lean();
    if (!noticia) throw new NotFoundException(`Noticia ${id} no encontrada`);

    const dir = path.join(process.cwd(), 'uploads', 'noticias', id);
    fs.mkdirSync(dir, { recursive: true });

    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));

    const ext = path.extname(archivo.originalname) || '.jpg';
    const filename = `imagen${ext}`;
    fs.writeFileSync(path.join(dir, filename), archivo.buffer);

    const imagen_url = `/uploads/noticias/${id}/${filename}`;
    return this.noticiaModel.findByIdAndUpdate(id, { imagen_url }, { new: true }).lean();
  }

  async remove(id: string) {
    const noticia = await this.noticiaModel.findByIdAndDelete(id).lean();
    if (!noticia) throw new NotFoundException(`Noticia ${id} no encontrada`);

    const dir = path.join(process.cwd(), 'uploads', 'noticias', id);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });

    return { message: 'Noticia eliminada', id };
  }
}
