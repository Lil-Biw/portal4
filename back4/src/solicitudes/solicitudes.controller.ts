import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards, Res, Req,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sendFile } from '../common/helpers/send-file.helper';
import { FileInterceptor } from '@nestjs/platform-express';
import { OPCIONES_SUBIDA } from '../common/constants/upload.constants';
import { SolicitudesService } from './solicitudes.service';
import { CreateSolicitudDto, UpdateSolicitudDto, CambiarEstadoDto } from './solicitudes.dto';
import { EmpresaAccessGuard, Roles, RequiereAccion } from '../common/guards/guards';

interface JwtUser {
  sub: string;
  rol: string;
}

@Controller('empresas/:empresaId/solicitudes')
@UseGuards(EmpresaAccessGuard)
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  @RequiereAccion('solicitudes', 'crear')
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
  @Roles('super_admin', 'admin_smartclarity')
  update(
    @Param('empresaId') empresaId: string,
    @Param('solicitudId') solicitudId: string,
    @Body() dto: UpdateSolicitudDto,
  ) {
    return this.solicitudesService.update(solicitudId, empresaId, dto);
  }

  @Delete(':solicitudId')
  @RequiereAccion('solicitudes', 'eliminar')
  remove(@Param('empresaId') empresaId: string, @Param('solicitudId') solicitudId: string) {
    return this.solicitudesService.remove(solicitudId, empresaId);
  }

  @Put(':solicitudId/estado')
  @RequiereAccion('solicitudes', 'cambiarEstado')
  cambiarEstado(
    @Param('empresaId') empresaId: string,
    @Param('solicitudId') solicitudId: string,
    @Body() dto: CambiarEstadoDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user as JwtUser;
    return this.solicitudesService.cambiarEstado(solicitudId, empresaId, dto, user?.sub);
  }

  @Post(':solicitudId/adjuntar')
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
  adjuntar(
    @Param('solicitudId') solicitudId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Req() req: Request,
    @Body('link_url') linkUrl?: string,
  ) {
    if (!archivo && !linkUrl) throw new BadRequestException('Debes adjuntar un archivo o un link');
    const user = (req as any).user as JwtUser;
    return this.solicitudesService.adjuntar(solicitudId, { archivo, linkUrl }, user?.sub, user?.rol);
  }

  @Get(':solicitudId/adjunto')
  async servirAdjunto(@Param('solicitudId') solicitudId: string, @Res() res: Response) {
    const { buffer, tipo_mime, nombre } = await this.solicitudesService.servirAdjunto(solicitudId);
    sendFile(res, buffer, tipo_mime, nombre);
  }
}

@Controller('solicitudes')
export class SolicitudesAdminController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Get('en-revision')
  @Roles('super_admin', 'admin_smartclarity')
  findEnRevision(@Req() req: Request) {
    const user = (req as any).user as JwtUser;
    return this.solicitudesService.findEnRevisionParaAdmin(user.sub, user.rol);
  }
}
