import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query,
} from '@nestjs/common';
import { CentrosCostosService } from './centros-costos.service';
import { CreateCentroCostoDto, UpdateCentroCostoDto, AgregarDocumentoDto } from './centros-costos.dto';

@Controller('centros-costos')
export class CentrosCostosController {
  constructor(private readonly centrosCostosService: CentrosCostosService) {}

  @Post()
  create(@Body() dto: CreateCentroCostoDto) {
    return this.centrosCostosService.create(dto);
  }

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.centrosCostosService.findAll(+page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.centrosCostosService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCentroCostoDto) {
    return this.centrosCostosService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.centrosCostosService.remove(id);
  }

  @Post(':centroCostoId/documentos')
  agregarDocumento(
    @Param('centroCostoId') id: string,
    @Body() dto: AgregarDocumentoDto,
  ) {
    return this.centrosCostosService.agregarDocumento(id, dto);
  }

  @Delete(':centroCostoId/documentos/:docId')
  eliminarDocumento(
    @Param('centroCostoId') centroCostoId: string,
    @Param('docId') docId: string,
  ) {
    return this.centrosCostosService.eliminarDocumento(centroCostoId, docId);
  }
}
