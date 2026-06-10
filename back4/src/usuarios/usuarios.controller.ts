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
} from './usuarios.dto';
import { Roles } from '../common/guards/guards';

interface JwtUser {
  sub: string;
  email: string;
  rol: string;
  cliente_id?: string;
}

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @Roles('super_admin', 'admin_smartclarity')
  create(@Body() dto: CreateUsuarioDto, @Req() req: Request) {
    const user = (req as any).user as JwtUser;
    if (user?.rol === 'admin_smartclarity') {
      if (dto.rol && dto.rol !== 'usuario') {
        throw new ForbiddenException('Solo puedes crear usuarios con rol "usuario"');
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
  @Roles('super_admin', 'admin_smartclarity')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUsuarioDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user as JwtUser;
    if (user?.rol === 'admin_smartclarity') {
      if (dto.rol && dto.rol !== 'usuario') {
        throw new ForbiddenException('Solo puedes asignar el rol "usuario"');
      }
      return this.usuariosService.update(id, { ...dto, rol: 'usuario' });
    }
    return this.usuariosService.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin_smartclarity')
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
}
