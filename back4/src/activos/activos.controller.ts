import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ActivosService } from './activos.service';
import { CreateActivoDto, UpdateActivoDto } from './activos.dto';
import { Roles } from '../common/guards/guards';

@Controller('activos')
export class ActivosController {
  constructor(private readonly activosService: ActivosService) {}

  @Get()
  findAll(@Query('centro_costo_id') centroCostoId?: string) {
    return this.activosService.findAll(centroCostoId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.activosService.findOne(id);
  }

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateActivoDto) {
    return this.activosService.create(dto);
  }

  @Put(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateActivoDto) {
    return this.activosService.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.activosService.remove(id);
  }
}
