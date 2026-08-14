import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { TiposActividadService } from './tipos-actividad.service';
import { CreateTipoActividadDto, UpdateTipoActividadDto } from './tipos-actividad.dto';
import { RequiereAccion } from '../common/guards/guards';

@Controller('tipos-actividad')
export class TiposActividadController {
  constructor(private readonly service: TiposActividadService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @RequiereAccion('catalogos', 'crear')
  create(@Body() dto: CreateTipoActividadDto) { return this.service.create(dto); }

  @Put(':id')
  @RequiereAccion('catalogos', 'editar')
  update(@Param('id') id: string, @Body() dto: UpdateTipoActividadDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequiereAccion('catalogos', 'eliminar')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
