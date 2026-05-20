import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { TiposMantencionService } from './tipos-mantencion.service';
import { CreateTipoMantencionDto, UpdateTipoMantencionDto } from './tipos-mantencion.dto';

@Controller('tipos-mantencion')
export class TiposMantencionController {
  constructor(private readonly service: TiposMantencionService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() dto: CreateTipoMantencionDto) { return this.service.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTipoMantencionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
