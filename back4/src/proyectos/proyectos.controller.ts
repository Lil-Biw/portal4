import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, Query, UseGuards, Res, Req,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sendFile } from '../common/helpers/send-file.helper';
import { FileInterceptor } from '@nestjs/platform-express';
import { OPCIONES_SUBIDA } from '../common/constants/upload.constants';
import { ProyectosService } from './proyectos.service';
import { CreateProyectoDto, UpdateProyectoDto, VencerDocumentoProyectoDto } from './proyectos.dto';
import { EmpresaAccessGuard, Roles, RequiereAccion } from '../common/guards/guards';

interface JwtUser {
  sub: string;
  email: string;
  rol: string;
  cliente_id?: string;
}

@Controller('empresas/:empresaId/centros/:centroId/proyectos')
@UseGuards(EmpresaAccessGuard)
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Post()
  @RequiereAccion('proyectos', 'crear')
  create(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Body() dto: CreateProyectoDto,
  ) {
    const centro_costo_ids = dto.centro_costo_ids?.length ? dto.centro_costo_ids : [centroId];
    return this.proyectosService.create({ ...dto, cliente_id: empresaId, centro_costo_ids });
  }

  @Get()
  findAll(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '500',
    @Req() req?: Request,
  ) {
    const user = (req as any)?.user as JwtUser;
    return this.proyectosService.findAllByCentro(centroId, +page, +limit, empresaId, user && { sub: user.sub, rol: user.rol });
  }

  @Get(':proyectoId')
  findOne(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Param('proyectoId') proyectoId: string,
    @Req() req: Request,
  ) {
    const user = (req as any)?.user as JwtUser;
    return this.proyectosService.findOne(proyectoId, empresaId, centroId, user && { sub: user.sub, rol: user.rol });
  }

  @Put(':proyectoId')
  @RequiereAccion('proyectos', 'editar')
  update(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Param('proyectoId') proyectoId: string,
    @Body() dto: UpdateProyectoDto,
  ) {
    return this.proyectosService.update(proyectoId, dto, empresaId, centroId);
  }

  @Delete(':proyectoId')
  @RequiereAccion('proyectos', 'eliminar')
  remove(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Param('proyectoId') proyectoId: string,
  ) {
    return this.proyectosService.remove(proyectoId, empresaId, centroId);
  }

  @Post(':proyectoId/documentos')
  @RequiereAccion('docProyecto', 'subir')
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
  subirDocumento(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Param('proyectoId') proyectoId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
    @Body('categoria') categoria?: string,
    @Body('link_url') linkUrl?: string,
    @Req() req?: Request,
  ) {
    if (!archivo && !linkUrl) throw new BadRequestException('Debes adjuntar un archivo o un link');
    const rolUploader = (req as any)?.user?.rol as string | undefined;
    const usuarioId  = (req as any)?.user?.sub as string | undefined;
    return this.proyectosService.agregarDocumento(proyectoId, { archivo, linkUrl }, nombreDisplay, categoria, usuarioId, rolUploader, empresaId, centroId);
  }

  @Get(':proyectoId/documentos')
  listarDocumentos(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Param('proyectoId') proyectoId: string,
    @Req() req: Request,
  ) {
    const user = (req as any)?.user as JwtUser;
    return this.proyectosService.listarDocumentos(proyectoId, empresaId, centroId, user && { sub: user.sub, rol: user.rol });
  }

  @Get(':proyectoId/documentos/:docId')
  async descargarDocumento(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Param('proyectoId') proyectoId: string,
    @Param('docId') docId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = (req as any)?.user as JwtUser;
    const { buffer, tipo_mime, nombre_display } = await this.proyectosService.servirDocumento(proyectoId, docId, empresaId, centroId, user && { sub: user.sub, rol: user.rol });
    sendFile(res, buffer, tipo_mime, nombre_display);
  }

  @Patch(':proyectoId/documentos/:docId')
  @RequiereAccion('docProyecto', 'editarCategoria')
  actualizarDocumento(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Param('proyectoId') proyectoId: string,
    @Param('docId') docId: string,
    @Body('categoria') categoria: string | undefined,
    @Body('nombre_display') nombreDisplay: string | undefined,
    @Req() req: Request,
  ) {
    const user = (req as any)?.user as JwtUser;
    const solicitante = user && { sub: user.sub, rol: user.rol };
    if (nombreDisplay !== undefined) {
      if (!nombreDisplay.trim()) throw new BadRequestException('Debes indicar un nombre');
      return this.proyectosService.renombrarDocumento(proyectoId, docId, nombreDisplay.trim(), empresaId, centroId, solicitante);
    }
    if (!categoria?.trim()) throw new BadRequestException('Debes indicar una categoría');
    return this.proyectosService.actualizarDocumento(proyectoId, docId, categoria.trim(), empresaId, centroId, solicitante);
  }

  @Delete(':proyectoId/documentos/:docId')
  @RequiereAccion('docProyecto', 'eliminar')
  eliminarDocumento(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Param('proyectoId') proyectoId: string,
    @Param('docId') docId: string,
    @Req() req: Request,
  ) {
    const user = (req as any)?.user as JwtUser;
    return this.proyectosService.eliminarDocumento(proyectoId, docId, empresaId, centroId, user && { sub: user.sub, rol: user.rol });
  }

  @Patch(':proyectoId/documentos/:docId/vencer')
  @RequiereAccion('docProyecto', 'vencer')
  vencerDocumento(
    @Param('empresaId')  empresaId:  string,
    @Param('centroId')   centroId:   string,
    @Param('proyectoId') proyectoId: string,
    @Param('docId')      docId:      string,
    @Body() dto: VencerDocumentoProyectoDto,
  ) {
    return this.proyectosService.vencerDocumento(
      proyectoId, docId, empresaId, centroId,
      dto.empresa_nombre, dto.centro_nombre, dto.proyecto_nombre,
      dto.notificacion,
    );
  }
}

@Controller('proyectos')
@Roles('super_admin', 'admin_smartclarity')
export class ProyectosAdminController {
  constructor(private readonly svc: ProyectosService) {}

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '500', @Query('estado') estado?: string) {
    return this.svc.findAll(+page, +limit, estado);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }
}

@Controller('empresas/:empresaId/proyectos')
@UseGuards(EmpresaAccessGuard)
export class ProyectosEmpresaController {
  constructor(private readonly svc: ProyectosService) {}

  @Get()
  findAll(
    @Param('empresaId') empresaId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '500',
    @Req() req?: Request,
  ) {
    const user = (req as any)?.user as JwtUser;
    return this.svc.findAllByCliente(empresaId, +page, +limit, user && { sub: user.sub, rol: user.rol });
  }
}
