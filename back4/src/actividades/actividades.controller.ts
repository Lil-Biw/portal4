import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, Req, Res, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sendFile } from '../common/helpers/send-file.helper';
import { FileInterceptor } from '@nestjs/platform-express';
import { OPCIONES_SUBIDA } from '../common/constants/upload.constants';
import { ActividadesService } from './actividades.service';
import { CreateActividadDto, UpdateActividadDto } from './actividades.dto';
import { EmpresaAccessGuard, Roles, RequiereAccion } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros/:centroId/actividades')
@UseGuards(EmpresaAccessGuard)
export class ActividadesController {
  constructor(private readonly service: ActividadesService) {}

  @Get()
  findAll(
    @Param('centroId') centroId: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.findAll(centroId, desde, hasta);
  }

  @Get(':actividadId')
  findOne(
    @Param('actividadId') actividadId: string,
    @Param('centroId') centroId: string,
    @Param('empresaId') empresaId: string,
  ) {
    return this.service.findOneEnCentro(actividadId, centroId, empresaId);
  }

  @Post()
  @RequiereAccion('actividades', 'crear')
  async create(
    @Param('centroId') centroId: string,
    @Param('empresaId') empresaId: string,
    @Body() dto: CreateActividadDto,
    @Req() req: Request,
  ) {
    const user = (req as any)?.user;
    await this.service.autorizarCreacion(centroId, empresaId, user && { sub: user.sub, rol: user.rol });
    const creadoPorId = user?.sub as string | undefined;
    return this.service.create({ ...dto, centro_costo_id: centroId }, creadoPorId);
  }

  @Put(':actividadId')
  @RequiereAccion('actividades', 'editar')
  async update(
    @Param('actividadId') actividadId: string,
    @Param('centroId') centroId: string,
    @Param('empresaId') empresaId: string,
    @Body() dto: UpdateActividadDto,
    @Req() req: Request,
  ) {
    const user = (req as any)?.user;
    await this.service.autorizarModificacion(
      actividadId, centroId, empresaId,
      user && { sub: user.sub, rol: user.rol },
      dto.centro_costo_id,
    );
    return this.service.update(actividadId, dto);
  }

  @Delete(':actividadId')
  @RequiereAccion('actividades', 'eliminar')
  async remove(
    @Param('actividadId') actividadId: string,
    @Param('centroId') centroId: string,
    @Param('empresaId') empresaId: string,
    @Req() req: Request,
  ) {
    const user = (req as any)?.user;
    await this.service.autorizarModificacion(
      actividadId, centroId, empresaId,
      user && { sub: user.sub, rol: user.rol },
    );
    return this.service.remove(actividadId);
  }

  @Get(':actividadId/documentos')
  listarDocumentos(
    @Param('actividadId') actividadId: string,
    @Param('centroId') centroId: string,
    @Param('empresaId') empresaId: string,
  ) {
    return this.service.listarDocumentos(actividadId, centroId, empresaId);
  }

  @Post(':actividadId/documentos')
  @RequiereAccion('docActividad', 'subir')
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
  async subirDocumento(
    @Param('actividadId') actividadId: string,
    @Param('centroId') centroId: string,
    @Param('empresaId') empresaId: string,
    @Req() req: Request,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
    @Body('link_url') linkUrl?: string,
  ) {
    if (!archivo && !linkUrl) throw new BadRequestException('Debes adjuntar un archivo o un link');
    const user = (req as any)?.user;
    // En el perfil consumidor, los documentos siguen la autoría de la actividad:
    // no se pueden adjuntar a actividades de admins Eclarity ni de centros no
    // asignados (misma regla que editar/eliminar la actividad).
    await this.service.autorizarModificacion(
      actividadId, centroId, empresaId,
      user && { sub: user.sub, rol: user.rol },
    );
    return this.service.subirDocumento(actividadId, { archivo, linkUrl }, nombreDisplay);
  }

  @Delete(':actividadId/documentos/:docId')
  @RequiereAccion('docActividad', 'eliminar')
  async eliminarDocumento(
    @Param('actividadId') actividadId: string,
    @Param('centroId') centroId: string,
    @Param('empresaId') empresaId: string,
    @Param('docId') docId: string,
    @Req() req: Request,
  ) {
    const user = (req as any)?.user;
    await this.service.autorizarModificacion(
      actividadId, centroId, empresaId,
      user && { sub: user.sub, rol: user.rol },
    );
    return this.service.eliminarDocumento(actividadId, docId);
  }

  @Patch(':actividadId/documentos/:docId')
  @Roles('super_admin', 'admin_smartclarity')
  renombrarDocumento(
    @Param('actividadId') actividadId: string,
    @Param('docId') docId: string,
    @Body('nombre_display') nombreDisplay: string,
  ) {
    if (!nombreDisplay?.trim()) throw new BadRequestException('Debes indicar un nombre');
    return this.service.renombrarDocumento(actividadId, docId, nombreDisplay.trim());
  }

  @Get(':actividadId/documentos/:docId')
  async descargarDocumento(
    @Param('actividadId') actividadId: string,
    @Param('docId') docId: string,
    @Param('centroId') centroId: string,
    @Param('empresaId') empresaId: string,
    @Res() res: Response,
  ) {
    const { buffer, tipo_mime, nombre_display } = await this.service.servirDocumento(actividadId, docId, centroId, empresaId);
    sendFile(res, buffer, tipo_mime, nombre_display);
  }
}

@Controller('empresas/:empresaId/actividades')
@UseGuards(EmpresaAccessGuard)
export class ActividadesEmpresaController {
  constructor(private readonly svc: ActividadesService) {}

  @Get()
  findAll(@Param('empresaId') empresaId: string, @Req() req: Request) {
    const user = (req as any)?.user;
    return this.svc.findAllByEmpresa(
      empresaId, undefined, undefined, undefined,
      user && { sub: user.sub, rol: user.rol },
    );
  }
}

@Controller('actividades')
@Roles('super_admin', 'admin_smartclarity')
export class ActividadesAdminController {
  constructor(private readonly svc: ActividadesService) {}

  @Get()
  findAll(
    @Query('centro_costo_id') centroCostoId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Req() req?: Request,
  ) {
    const user = (req as any)?.user;
    if (user?.rol === 'admin_smartclarity' && user?.cliente_id) {
      return this.svc.findAllByEmpresa(user.cliente_id, centroCostoId, desde, hasta);
    }
    return this.svc.findAll(centroCostoId, desde, hasta);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }
}
