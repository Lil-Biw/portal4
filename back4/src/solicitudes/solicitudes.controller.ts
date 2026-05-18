import {
  Controller, Get, Post, Put,
  Param, Body, Query,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SolicitudesService } from './solicitudes.service';
import { CreateSolicitudDto, CambiarEstadoDto } from './solicitudes.dto';

@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  create(@Body() dto: CreateSolicitudDto) {
    return this.solicitudesService.create(dto);
  }

  @Get()
  findAll(
    @Query('empresa_id') empresa_id: string,
    @Query('centro_id')  centro_id?: string,
    @Query('proyecto_id') proyecto_id?: string,
    @Query('estado') estado?: string,
  ) {
    if (!empresa_id) throw new BadRequestException('empresa_id es requerido');
    return this.solicitudesService.findByContexto(empresa_id, centro_id, proyecto_id, estado);
  }

  @Put(':id/estado')
  cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoDto) {
    return this.solicitudesService.cambiarEstado(id, dto);
  }

  @Post(':id/adjuntar')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  adjuntar(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.solicitudesService.adjuntarArchivo(id, archivo);
  }
}
