import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, Request,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto, UpdateUsuarioDto, CambiarPasswordDto } from './usuarios.dto';
import { Roles } from '../common/guards/guards';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @Roles('admin_cliente')
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
  @Roles('admin_cliente')
  update(@Param('id') id: string, @Body() dto: UpdateUsuarioDto) {
    return this.usuariosService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin_cliente')
  remove(@Param('id') id: string) {
    return this.usuariosService.remove(id);
  }
}
