import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { UsuarioDocument } from './usuarios.schema';
import { CreateUsuarioDto, UpdateUsuarioDto, CambiarPasswordDto, PermisoUsuarioDto } from './usuarios.dto';
import { PermisosService } from '../permisos/permisos.service';

const SALT_ROUNDS = 10;

@Injectable()
export class UsuariosService {
  constructor(
    @InjectModel('Usuario') private usuarioModel: Model<UsuarioDocument>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<any>,
    private permisosService: PermisosService,
  ) {}

  private async validarCentrosDeCliente(clienteId: string, permisos?: PermisoUsuarioDto[]) {
    if (!permisos || permisos.length === 0) return;

    const ids = permisos.map((permiso) => permiso.centro_costo_id);
    const centros = await this.centroCostoModel.find({
      _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
      cliente_id: new Types.ObjectId(clienteId),
      activo: true,
    }).lean();

    if (centros.length !== ids.length) {
      throw new BadRequestException('Uno o más centros no pertenecen a la empresa indicada');
    }
  }

  private async sincronizarPermisos(usuarioId: string, clienteId: string, permisos?: PermisoUsuarioDto[]) {
    if (permisos === undefined) return;

    await this.validarCentrosDeCliente(clienteId, permisos);

    const permisosActuales = await this.permisosService.findByUsuario(usuarioId);
    const permisosSeleccionados = new Map((permisos || []).map((permiso) => [permiso.centro_costo_id, permiso]));

    for (const permisoActual of permisosActuales) {
      const centroId = permisoActual?.centro_costo_id?._id?.toString?.() || permisoActual?.centro_costo_id?.toString?.() || '';
      if (!permisosSeleccionados.has(centroId)) {
        await this.permisosService.revocar(usuarioId, centroId);
      }
    }

    for (const permiso of permisos || []) {
      await this.permisosService.asignar(
        { usuario_id: usuarioId, centro_costo_id: permiso.centro_costo_id, tipo: permiso.tipo },
        usuarioId,
        clienteId,
      );
    }
  }

  async create(dto: CreateUsuarioDto) {
    const existe = await this.usuarioModel.findOne({ email: dto.email });
    if (existe) throw new ConflictException(`El email ${dto.email} ya está registrado`);

    const { password, permisos, permiso_acceso, ...rest } = dto;
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const permisoPorDefecto = permiso_acceso || (rest.rol === 'admin_cliente' ? 'editar' : 'ver');

    const usuario = new this.usuarioModel({ ...rest, permiso_acceso: permisoPorDefecto, password_hash });
    const saved = await usuario.save();

    await this.sincronizarPermisos(saved._id.toString(), rest.cliente_id.toString(), permisos);

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
    const usuario = await this.usuarioModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean();
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado`);

    await this.sincronizarPermisos(id, usuario.cliente_id.toString(), dto.permisos as PermisoUsuarioDto[] | undefined);
    return usuario;
  }

  // async cambiarPassword(id: string, dto: CambiarPasswordDto) {
  //   const usuario = await this.usuarioModel.findById(id).select('+password_hash');
  //   if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado`);

  //   const valida = await bcrypt.compare(dto.password_actual, usuario.password_hash);
  //   if (!valida) throw new BadRequestException('La contraseña actual es incorrecta');

  //   usuario.password_hash = await bcrypt.hash(dto.password_nueva, SALT_ROUNDS);
  //   await usuario.save();
  //   return { message: 'Contraseña actualizada correctamente' };
  // }

  async remove(id: string) {
    const usuario = await this.usuarioModel
      .findByIdAndUpdate(id, { activo: false }, { new: true })
      .lean();
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return { message: 'Usuario desactivado', id };
  }
}
