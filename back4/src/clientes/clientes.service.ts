import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cliente, ClienteDocument } from './clientes.schema';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';
import { DocumentosHelper, ArchivoInput } from '../common/helpers/documentos.helper';
import { DocumentosVencidosService } from '../documentos-vencidos/documentos-vencidos.service';

@Injectable()
export class ClientesService {
  private readonly docsHelper: DocumentosHelper;

  constructor(
    @InjectModel('Cliente') private clienteModel: Model<ClienteDocument>,
    private readonly documentosVencidosService: DocumentosVencidosService,
  ) {
    this.docsHelper = new DocumentosHelper(clienteModel, 'Cliente', '-logo.contenido -documentos.contenido');
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

  async updateScoreSmartclarity(id: string, valores: number[]) {
    const cliente = await this.clienteModel
      .findByIdAndUpdate(id, { score_smartclarity: valores }, { new: true, runValidators: true })
      .select('-logo.contenido -documentos.contenido')
      .lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async updateConfigGrafico(id: string, mostrarPromedio: boolean) {
    const cliente = await this.clienteModel
      .findByIdAndUpdate(id, { mostrar_grafico_promedio: mostrarPromedio }, { new: true, runValidators: true })
      .select('-logo.contenido -documentos.contenido')
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

  agregarDocumento(id: string, archivo: ArchivoInput, nombreDisplay?: string, categoria?: string) {
    return this.docsHelper.agregar(id, archivo, nombreDisplay, categoria);
  }

  listarDocumentos(id: string) {
    return this.docsHelper.listar(id);
  }

  servirDocumento(clienteId: string, docId: string) {
    return this.docsHelper.servir(clienteId, docId);
  }

  eliminarDocumento(clienteId: string, docId: string) {
    return this.docsHelper.eliminar(clienteId, docId);
  }

  async vencerDocumento(clienteId: string, docId: string, empresaNombre?: string) {
    const cliente = await this.clienteModel.findById(clienteId);
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
    const doc = cliente.documentos.find((d: any) => String(d._id) === docId);
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

    await this.clienteModel.findByIdAndUpdate(
      clienteId,
      { $pull: { documentos: { _id: (doc as any)._id } } },
    );

    await this.documentosVencidosService.crear({
      nombre_display: doc.nombre_display,
      categoria:      doc.categoria,
      tipo_mime:      doc.tipo_mime,
      tamano_bytes:   doc.tamano_bytes,
      contenido:      doc.contenido,
      origen_tipo:    'empresa',
      empresa_id:     clienteId,
      empresa_nombre: empresaNombre,
      subido_en:      doc.subido_en,
    });

    return { message: 'Documento marcado como vencido', docId };
  }
}
