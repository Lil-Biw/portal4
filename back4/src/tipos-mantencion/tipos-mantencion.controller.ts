import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { TiposMantencionService } from './tipos-mantencion.service';
import { CreateTipoMantencionDto, UpdateTipoMantencionDto } from './tipos-mantencion.dto';
import { Roles } from '../common/guards/guards';

@Controller('tipos-mantencion')
export class TiposMantencionController {
  constructor(private readonly service: TiposMantencionService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateTipoMantencionDto) { return this.service.create(dto); }

  @Put(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateTipoMantencionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
