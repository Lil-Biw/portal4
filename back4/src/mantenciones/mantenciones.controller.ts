import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { MantencionesService } from './mantenciones.service';
import { CreateMantencionDto, UpdateMantencionDto } from './mantenciones.dto';
import { Roles } from '../common/guards/guards';

@Controller('mantenciones')
export class MantencionesController {
  constructor(private readonly service: MantencionesService) {}

  @Get()
  findAll(
    @Query('centro_costo_id') centroCostoId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.findAll(centroCostoId, desde, hasta);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateMantencionDto) { return this.service.create(dto); }

  @Put(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateMantencionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
