import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { MantencionesService } from './mantenciones.service';
import { CreateMantencionDto, UpdateMantencionDto } from './mantenciones.dto';

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
  create(@Body() dto: CreateMantencionDto) { return this.service.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMantencionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
