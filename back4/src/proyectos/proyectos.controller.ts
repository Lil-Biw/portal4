import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query,
} from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import { CreateProyectoDto, UpdateProyectoDto, AgregarDocumentoProyectoDto } from './proyectos.dto';
import { Roles } from '../common/guards/guards';

@Controller('proyectos')
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateProyectoDto) {
    return this.proyectosService.create(dto);
  }

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.proyectosService.findAll(+page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.proyectosService.findOne(id);
  }

  @Put(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateProyectoDto) {
    return this.proyectosService.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.proyectosService.remove(id);
  }

  @Post(':id/documentos')
  @Roles('super_admin')
  agregarDocumento(@Param('id') id: string, @Body() dto: AgregarDocumentoProyectoDto) {
    return this.proyectosService.agregarDocumento(id, dto);
  }

  @Delete(':id/documentos/:docId')
  @Roles('super_admin')
  eliminarDocumento(@Param('id') id: string, @Param('docId') docId: string) {
    return this.proyectosService.eliminarDocumento(id, docId);
  }
}
