import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, Req, ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto, UpdateUsuarioDto, CambiarPasswordDto } from './usuarios.dto';
import { Roles } from '../common/guards/guards';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.create(dto);
  }

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.usuariosService.findAll(+page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usuariosService.findOne(id);
  }

  @Put(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateUsuarioDto) {
    return this.usuariosService.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.usuariosService.remove(id);
  }

  @Patch(':id/password')
  cambiarPassword(@Param('id') id: string, @Body() dto: CambiarPasswordDto, @Req() req: Request) {
    const user = (req as any).user;
    if (user?.sub !== id && user?.rol !== 'super_admin') {
      throw new ForbiddenException('Solo puedes cambiar tu propia contraseña');
    }
    return this.usuariosService.cambiarPassword(id, dto);
  }
}
