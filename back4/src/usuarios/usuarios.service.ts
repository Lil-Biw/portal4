import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsuarioDocument } from './usuarios.schema';
import { CreateUsuarioDto, UpdateUsuarioDto, CambiarPasswordDto } from './usuarios.dto';
import { MailService } from '../mail/mail.service';

const SALT_ROUNDS = 10;

function generarPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    @InjectModel('Usuario') private usuarioModel: Model<UsuarioDocument>,
    private mailService: MailService,
  ) {}

  async create(dto: CreateUsuarioDto) {
    const existe = await this.usuarioModel.findOne({ email: dto.email });
    if (existe) throw new ConflictException(`El email ${dto.email} ya está registrado`);

    const { permiso_acceso, centros_asignados, ...rest } = dto;
    const password = generarPassword();
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const permisoPorDefecto = permiso_acceso || (rest.rol === 'admin_cliente' ? 'editar' : 'ver');

    const cliente_id = rest.cliente_id ? new Types.ObjectId(rest.cliente_id) : undefined;
    const centrosIds = (centros_asignados ?? []).map(id => new Types.ObjectId(id));

    const usuario = new this.usuarioModel({
      ...rest,
      cliente_id,
      permiso_acceso: permisoPorDefecto,
      password_hash,
      centros_asignados: centrosIds,
    });
    const saved = await usuario.save();

    await this.mailService.notificarNuevoUsuario({
      nombre:   rest.nombre,
      email:    dto.email,
      password,
    });

    const { password_hash: _, ...result } = saved.toObject();
    return result;
  }

  async findAll(page = 1, limit = 20) {
    const filter = { activo: true };
    const [data, total] = await Promise.all([
      this.usuarioModel.find(filter).skip((page - 1) * limit).limit(limit).lean(),
      this.usuarioModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findAllByCliente(cliente_id: string, page = 1, limit = 20) {
    const filter = { cliente_id: new Types.ObjectId(cliente_id), activo: true };
    const [data, total] = await Promise.all([
      this.usuarioModel.find(filter).skip((page - 1) * limit).limit(limit).lean(),
      this.usuarioModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const usuario = await this.usuarioModel.findById(id).lean();
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return usuario;
  }

  async update(id: string, dto: UpdateUsuarioDto) {
    this.logger.log(`update usuario=${id}`);
    const { centros_asignados, ...camposMongo } = dto;
    const payload: Record<string, unknown> = { ...camposMongo };

    if (centros_asignados !== undefined) {
      payload['centros_asignados'] = centros_asignados.map(cid => new Types.ObjectId(cid));
    }

    const usuario = await this.usuarioModel
      .findByIdAndUpdate(id, payload, { new: true })
      .lean();
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado`);

    return usuario;
  }

  async cambiarPassword(id: string, dto: CambiarPasswordDto) {
    const usuario = await this.usuarioModel.findById(id).select('+password_hash');
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado`);

    const valida = await bcrypt.compare(dto.password_actual, usuario.password_hash);
    if (!valida) throw new BadRequestException('La contraseña actual es incorrecta');

    usuario.password_hash = await bcrypt.hash(dto.password_nueva, SALT_ROUNDS);
    (usuario as any).debe_cambiar_password = false;
    await usuario.save();
    return { message: 'Contraseña actualizada correctamente' };
  }

  async remove(id: string) {
    const usuario = await this.usuarioModel
      .findByIdAndUpdate(id, { activo: false }, { new: true })
      .lean();
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return { message: 'Usuario desactivado', id };
  }
}
