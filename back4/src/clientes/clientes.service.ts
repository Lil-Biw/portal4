import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cliente, ClienteDocument } from './clientes.schema';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ClientesService {
  constructor(@InjectModel('Cliente') private clienteModel: Model<ClienteDocument>) {}

  async create(dto: CreateClienteDto) {
    const existe = await this.clienteModel.findOne({ rut: dto.rut });
    if (existe) throw new ConflictException(`Ya existe un cliente con RUT ${dto.rut}`);
    const cliente = new this.clienteModel(dto);
    return cliente.save();
  }

  async findAll(page = 1, limit = 20, soloActivos = true) {
    const filter = soloActivos ? { activo: true } : {};
    const [data, total] = await Promise.all([
      this.clienteModel.find(filter).skip((page - 1) * limit).limit(limit).lean(),
      this.clienteModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const cliente = await this.clienteModel.findById(id).lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async update(id: string, dto: UpdateClienteDto) {
    const cliente = await this.clienteModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
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

  async subirLogo(id: string, archivo: { originalname: string; buffer: Buffer; mimetype: string }) {
    const cliente = await this.clienteModel.findById(id).lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);

    const logosDir = path.join(process.cwd(), 'uploads', 'logos', id);
    if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });

    // Eliminar logo anterior si existe
    if (fs.existsSync(logosDir)) {
      for (const f of fs.readdirSync(logosDir)) {
        fs.unlinkSync(path.join(logosDir, f));
      }
    }

    const ext = path.extname(archivo.originalname) || '.png';
    const filename = `logo${ext}`;
    const filePath = path.join(logosDir, filename);
    fs.writeFileSync(filePath, archivo.buffer);

    const logo_url = `/uploads/logos/${id}/${filename}`;
    return this.clienteModel
      .findByIdAndUpdate(id, { logo_url }, { new: true, runValidators: false })
      .lean();
  }
}
