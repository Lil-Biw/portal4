import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cliente, ClienteDocument } from './clientes.schema';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';

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
      this.clienteModel.find(filter).select('-logo.contenido').skip((page - 1) * limit).limit(limit).lean(),
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
    const cliente = await this.clienteModel.findById(id);
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    if (!cliente.logo?.contenido) throw new NotFoundException('Este cliente no tiene logo');
    const raw = cliente.logo.contenido as unknown;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    return { buffer, tipo_mime: cliente.logo.tipo_mime, nombre: cliente.logo.nombre };
  }

  async agregarDocumento(
    id: string,
    archivo: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    nombreDisplay?: string,
    categoria?: string,
  ) {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const nombre = `${timestamp}_${rand}_${archivo.originalname}`;
    const nuevoDoc: Record<string, unknown> = {
      nombre,
      nombre_display: nombreDisplay?.trim() || archivo.originalname,
      tipo_mime: archivo.mimetype,
      tamano_bytes: archivo.size,
      contenido: archivo.buffer,
      subido_en: new Date(),
    };
    if (categoria) nuevoDoc['categoria'] = categoria;
    const cliente = await this.clienteModel
      .findByIdAndUpdate(id, { $push: { documentos: nuevoDoc } }, { new: true })
      .select('-logo.contenido -documentos.contenido')
      .lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente.documentos[cliente.documentos.length - 1];
  }

  async listarDocumentos(id: string) {
    const cliente = await this.clienteModel.findById(id).select('-logo.contenido -documentos.contenido').lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente.documentos ?? [];
  }

  async servirDocumento(clienteId: string, docId: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    const cliente = await this.clienteModel.findById(clienteId);
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
    const doc = (cliente.documentos ?? []).find(d => String((d as any)._id) === docId);
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);
    const raw = (doc as any).contenido as unknown;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    return { buffer, tipo_mime: (doc as any).tipo_mime, nombre_display: (doc as any).nombre_display };
  }

  async eliminarDocumento(clienteId: string, docId: string) {
    const { Types } = await import('mongoose');
    const cliente = await this.clienteModel
      .findByIdAndUpdate(
        clienteId,
        { $pull: { documentos: { _id: new Types.ObjectId(docId) } } },
        { new: true },
      )
      .lean();
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
    return { message: 'Documento eliminado', docId };
  }
}
