import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { TiposActivoService } from './tipos-activo.service';
import { CreateTipoActivoDto, UpdateTipoActivoDto } from './tipos-activo.dto';
import { RequiereAccion } from '../common/guards/guards';

@Controller('tipos-activo')
export class TiposActivoController {
  constructor(private readonly service: TiposActivoService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @RequiereAccion('catalogos', 'crear')
  create(@Body() dto: CreateTipoActivoDto) { return this.service.create(dto); }

  @Put(':id')
  @RequiereAccion('catalogos', 'editar')
  update(@Param('id') id: string, @Body() dto: UpdateTipoActivoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequiereAccion('catalogos', 'eliminar')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
