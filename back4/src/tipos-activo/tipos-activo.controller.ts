import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { TiposActivoService } from './tipos-activo.service';
import { CreateTipoActivoDto, UpdateTipoActivoDto } from './tipos-activo.dto';
import { Roles } from '../common/guards/guards';

@Controller('tipos-activo')
export class TiposActivoController {
  constructor(private readonly service: TiposActivoService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateTipoActivoDto) { return this.service.create(dto); }

  @Put(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateTipoActivoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
