import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SolicitudesService } from './solicitudes.service';
import { CreateSolicitudDto, UpdateSolicitudDto, CambiarEstadoDto } from './solicitudes.dto';
import { EmpresaAccessGuard } from '../common/guards/guards';

@Controller('empresas/:empresaId/solicitudes')
@UseGuards(EmpresaAccessGuard)
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  create(@Param('empresaId') empresaId: string, @Body() dto: CreateSolicitudDto) {
    return this.solicitudesService.create({ ...dto, empresa_id: empresaId });
  }

  @Get()
  findAll(
    @Param('empresaId') empresaId: string,
    @Query('centroId') centroId?: string,
    @Query('proyectoId') proyectoId?: string,
    @Query('estado') estado?: string,
  ) {
    return this.solicitudesService.findByContexto(empresaId, centroId, proyectoId, estado);
  }

  @Patch(':solicitudId')
  update(@Param('solicitudId') solicitudId: string, @Body() dto: UpdateSolicitudDto) {
    return this.solicitudesService.update(solicitudId, dto);
  }

  @Delete(':solicitudId')
  remove(@Param('solicitudId') solicitudId: string) {
    return this.solicitudesService.remove(solicitudId);
  }

  @Put(':solicitudId/estado')
  cambiarEstado(@Param('solicitudId') solicitudId: string, @Body() dto: CambiarEstadoDto) {
    return this.solicitudesService.cambiarEstado(solicitudId, dto);
  }

  @Post(':solicitudId/adjuntar')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  adjuntar(
    @Param('solicitudId') solicitudId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.solicitudesService.adjuntarArchivo(solicitudId, archivo);
  }
}
