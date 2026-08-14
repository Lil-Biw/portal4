import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { TiposProyectoService } from './tipos-proyecto.service';
import { CreateTipoProyectoDto, UpdateTipoProyectoDto } from './tipos-proyecto.dto';
import { RequiereAccion } from '../common/guards/guards';

@Controller('tipos-proyecto')
export class TiposProyectoController {
  constructor(private readonly service: TiposProyectoService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @RequiereAccion('catalogos', 'crear')
  create(@Body() dto: CreateTipoProyectoDto) { return this.service.create(dto); }

  @Put(':id')
  @RequiereAccion('catalogos', 'editar')
  update(@Param('id') id: string, @Body() dto: UpdateTipoProyectoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequiereAccion('catalogos', 'eliminar')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
