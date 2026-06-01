import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, Res, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MantencionesService } from './mantenciones.service';
import { CreateMantencionDto, UpdateMantencionDto } from './mantenciones.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros/:centroId/mantenciones')
@UseGuards(EmpresaAccessGuard)
export class MantencionesController {
  constructor(private readonly service: MantencionesService) {}

  @Get()
  findAll(
    @Param('centroId') centroId: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.findAll(centroId, desde, hasta);
  }

  @Get(':mantencionId')
  findOne(@Param('mantencionId') mantencionId: string) {
    return this.service.findOne(mantencionId);
  }

  @Post()
  @Roles('super_admin')
  create(@Param('centroId') centroId: string, @Body() dto: CreateMantencionDto) {
    return this.service.create({ ...dto, centro_costo_id: centroId });
  }

  @Put(':mantencionId')
  @Roles('super_admin')
  update(@Param('mantencionId') mantencionId: string, @Body() dto: UpdateMantencionDto) {
    return this.service.update(mantencionId, dto);
  }

  @Delete(':mantencionId')
  @Roles('super_admin')
  remove(@Param('mantencionId') mantencionId: string) {
    return this.service.remove(mantencionId);
  }

  @Post(':mantencionId/documentos')
  @Roles('super_admin')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  subirDocumento(
    @Param('mantencionId') mantencionId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.service.subirDocumento(mantencionId, archivo, nombreDisplay);
  }

  @Delete(':mantencionId/documentos/:nombre')
  @Roles('super_admin')
  eliminarDocumento(
    @Param('mantencionId') mantencionId: string,
    @Param('nombre') nombre: string,
  ) {
    return this.service.eliminarDocumento(mantencionId, nombre);
  }

  @Get(':mantencionId/documentos/:nombre')
  async descargarDocumento(
    @Param('mantencionId') mantencionId: string,
    @Param('nombre') nombre: string,
    @Res() res: Response,
  ) {
    const { buffer, tipo_mime, nombre_display } = await this.service.servirDocumento(mantencionId, nombre);
    res.setHeader('Content-Type', tipo_mime);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre_display)}"`);
    res.send(buffer);
  }
}
