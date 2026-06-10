import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsuarioDocument } from './usuarios.schema';
import {
  CreateUsuarioDto,
  UpdateUsuarioDto,
  CambiarPasswordDto,
} from './usuarios.dto';
import { MailService } from '../mail/mail.service';
import { CentroCostoDocument } from '../centros-costos/centros-costos.schema';

const SALT_ROUNDS = 10;

function generarPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');
}

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    @InjectModel('Usuario') private usuarioModel: Model<UsuarioDocument>,
    @InjectModel('CentroCosto')
    private centroCostoModel: Model<CentroCostoDocument>,
    private mailService: MailService,
  ) {}

  private toObjectId(id: string) {
    return new Types.ObjectId(id);
  }

  private async validarCentrosAsignados(
    clienteId: string | undefined,
    centros: string[] = [],
  ) {
    const centrosUnicos = [...new Set(centros.filter(Boolean))];
    if (centrosUnicos.length === 0) return [];
    if (!clienteId) {
      throw new BadRequestException(
        'Debes asignar una empresa antes de asignar centros de costos',
      );
    }

    const centroIds = centrosUnicos.map((id) => this.toObjectId(id));
    const total = await this.centroCostoModel.countDocuments({
      _id: { $in: centroIds },
      cliente_id: this.toObjectId(clienteId),
      activo: true,
    });

    if (total !== centroIds.length) {
      throw new BadRequestException(
        'Uno o más centros de costos no pertenecen a la empresa del usuario',
      );
    }

    return centroIds;
  }

  async create(dto: CreateUsuarioDto) {
    const email = dto.email.toLowerCase().trim();
    const existe = await this.usuarioModel.findOne({ email });
    if (existe)
      throw new ConflictException(`El email ${email} ya está registrado`);

    const { permiso_acceso, centros_asignados, ...rest } = dto;
    const password = generarPassword();
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const permisoPorDefecto =
      permiso_acceso || (rest.rol === 'admin_smartclarity' ? 'editar' : 'ver');

    const cliente_id = rest.cliente_id
      ? this.toObjectId(rest.cliente_id)
      : undefined;
    const centrosIds = await this.validarCentrosAsignados(
      rest.cliente_id,
      centros_asignados,
    );

    const usuario = new this.usuarioModel({
      ...rest,
      email,
      cliente_id,
      permiso_acceso: permisoPorDefecto,
      password_hash,
      centros_asignados: centrosIds,
    });
    const saved = await usuario.save();

    await this.mailService.notificarNuevoUsuario({
      nombre: rest.nombre,
      email,
      password,
    });

    const { password_hash: _, ...result } = saved.toObject();
    return result;
  }

  async findAll(page = 1, limit = 20) {
    const filter = { activo: true };
    const [data, total] = await Promise.all([
      this.usuarioModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.usuarioModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findAllByCliente(
    cliente_id: string,
    page = 1,
    limit = 20,
    soloUsuarios = false,
  ) {
    const filter: Record<string, unknown> = {
      cliente_id: this.toObjectId(cliente_id),
      activo: true,
    };
    if (soloUsuarios) filter['rol'] = 'usuario';
    const [data, total] = await Promise.all([
      this.usuarioModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.usuarioModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const usuario = await this.usuarioModel.findById(id).lean();
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return usuario;
  }

  async findOneByCliente(id: string, clienteId: string, soloUsuarios = false) {
    const filter: Record<string, unknown> = {
      _id: this.toObjectId(id),
      cliente_id: this.toObjectId(clienteId),
      activo: true,
    };
    if (soloUsuarios) filter['rol'] = 'usuario';

    const usuario = await this.usuarioModel.findOne(filter).lean();
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return usuario;
  }

  async update(id: string, dto: UpdateUsuarioDto) {
    this.logger.log(`update usuario=${id}`);
    const usuarioActual = await this.usuarioModel.findById(id).lean();
    if (!usuarioActual)
      throw new NotFoundException(`Usuario ${id} no encontrado`);

    const { centros_asignados, ...camposMongo } = dto;
    const payload: Record<string, unknown> = { ...camposMongo };

    if (centros_asignados !== undefined) {
      payload['centros_asignados'] = await this.validarCentrosAsignados(
        usuarioActual.cliente_id ? String(usuarioActual.cliente_id) : undefined,
        centros_asignados,
      );
    }

    const usuario = await this.usuarioModel
      .findByIdAndUpdate(id, payload, { new: true })
      .lean();
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado`);

    return usuario;
  }

  async updateByCliente(id: string, clienteId: string, dto: UpdateUsuarioDto) {
    this.logger.log(`update usuario=${id} cliente=${clienteId}`);
    const { centros_asignados, rol: _rol, ...camposMongo } = dto;
    const payload: Record<string, unknown> = { ...camposMongo };

    if (centros_asignados !== undefined) {
      payload['centros_asignados'] = await this.validarCentrosAsignados(
        clienteId,
        centros_asignados,
      );
    }

    const usuario = await this.usuarioModel
      .findOneAndUpdate(
        {
          _id: this.toObjectId(id),
          cliente_id: this.toObjectId(clienteId),
          activo: true,
        },
        payload,
        { new: true },
      )
      .lean();
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado`);

    return usuario;
  }

  async cambiarPassword(id: string, dto: CambiarPasswordDto) {
    const usuario = await this.usuarioModel
      .findById(id)
      .select('+password_hash');
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado`);

    const valida = await bcrypt.compare(
      dto.password_actual,
      usuario.password_hash,
    );
    if (!valida)
      throw new BadRequestException('La contraseña actual es incorrecta');

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

  async removeByCliente(id: string, clienteId: string) {
    const usuario = await this.usuarioModel
      .findOneAndUpdate(
        {
          _id: this.toObjectId(id),
          cliente_id: this.toObjectId(clienteId),
          activo: true,
        },
        { activo: false },
        { new: true },
      )
      .lean();
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return { message: 'Usuario desactivado', id };
  }
}
