import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { UsuariosService } from './usuarios.service';
import {
  CreateUsuarioDto,
  UpdateUsuarioDto,
  CambiarPasswordDto,
  SuscripcionesDto,
  ActualizarPermisosDto,
} from './usuarios.dto';
import { Roles, RequiereAccion } from '../common/guards/guards';

interface JwtUser {
  sub: string;
  email: string;
  rol: string;
  cliente_id?: string;
  permisos?: Record<string, Record<string, boolean>>;
}

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @RequiereAccion('usuarios', 'crear')
  create(@Body() dto: CreateUsuarioDto, @Req() req: Request) {
    const user = (req as any).user as JwtUser;
    const puedeCrearAdmin = user?.rol === 'super_admin' || user?.permisos?.usuarios?.crearAdmin === true;
    if (!puedeCrearAdmin) {
      if (dto.rol && dto.rol !== 'usuario') {
        throw new ForbiddenException('No tienes permiso para crear usuarios con ese rol');
      }
      return this.usuariosService.create({ ...dto, rol: 'usuario' });
    }
    if (dto.rol && !['usuario', 'admin_smartclarity', 'super_admin'].includes(dto.rol))
      throw new ForbiddenException(`Rol "${dto.rol}" no válido`);
    return this.usuariosService.create(dto);
  }

  @Get()
  @Roles('super_admin', 'admin_smartclarity')
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.usuariosService.findAll(+page, +limit);
  }

  @Get(':id')
  @Roles('super_admin', 'admin_smartclarity')
  findOne(@Param('id') id: string) {
    return this.usuariosService.findOne(id);
  }

  @Put(':id')
  @RequiereAccion('usuarios', 'editar')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUsuarioDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user as JwtUser;
    const puedeCrearAdmin = user?.rol === 'super_admin' || user?.permisos?.usuarios?.crearAdmin === true;
    if (!puedeCrearAdmin) {
      if (dto.rol && dto.rol !== 'usuario') {
        throw new ForbiddenException('No tienes permiso para asignar ese rol');
      }
      return this.usuariosService.update(id, { ...dto, rol: 'usuario' });
    }
    return this.usuariosService.update(id, dto);
  }

  @Delete(':id')
  @RequiereAccion('usuarios', 'eliminar')
  remove(@Param('id') id: string) {
    return this.usuariosService.remove(id);
  }

  @Patch(':id/password')
  cambiarPassword(
    @Param('id') id: string,
    @Body() dto: CambiarPasswordDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    if (user?.sub !== id && user?.rol !== 'super_admin') {
      throw new ForbiddenException('Solo puedes cambiar tu propia contraseña');
    }
    return this.usuariosService.cambiarPassword(id, dto);
  }

  @Patch(':id/suscripciones')
  @Roles('super_admin', 'admin_smartclarity')
  actualizarSuscripciones(
    @Param('id') id: string,
    @Body() dto: SuscripcionesDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user as JwtUser;
    if (user?.sub !== id) {
      throw new ForbiddenException('Solo puedes editar tus propias suscripciones');
    }
    return this.usuariosService.actualizarSuscripciones(id, dto);
  }

  @Patch(':id/permisos')
  @Roles('super_admin', 'admin_smartclarity')
  actualizarPermisos(@Param('id') id: string, @Body() dto: ActualizarPermisosDto) {
    return this.usuariosService.actualizarPermisos(id, dto);
  }
}
