import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, Req, Res,
  UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { OPCIONES_SUBIDA } from '../common/constants/upload.constants';
import { Response, Request } from 'express';
import { NewslettersService } from './newsletters.service';
import {
  CreateNewsletterDto,
  UpdateNewsletterDto,
  RechazarNewsletterDto,
} from './newsletters.dto';
import { Public, Roles, RequiereAccion } from '../common/guards/guards';

interface UsuarioAutenticado {
  sub: string;
  email: string;
  rol: string;
  cliente_id?: string;
}

@Controller('newsletters')
export class NewslettersController {
  constructor(private readonly newslettersService: NewslettersService) {}

  @Get()
  @Roles('super_admin', 'admin_smartclarity')
  findAll() {
    return this.newslettersService.findAll();
  }

  @Get('imagenes/:imagenId')
  @Public()
  async getImagen(@Param('imagenId') imagenId: string, @Res() res: Response) {
    const { data, mimetype } = await this.newslettersService.getImagen(imagenId);
    res.setHeader('Content-Type', mimetype);
    res.send(data);
  }

  @Get('sugerencias')
  @Roles('super_admin')
  listarSugerencias(@Req() req: Request) {
    const user = req.user as UsuarioAutenticado;
    return this.newslettersService.listarSugerencias(user.rol);
  }

  @Get('pendientes-count')
  @Roles('super_admin')
  async contarPendientes() {
    const count = await this.newslettersService.contarPendientesAprobacion();
    return { count };
  }

  @Get(':id')
  @Roles('super_admin', 'admin_smartclarity')
  findOne(@Param('id') id: string) {
    return this.newslettersService.findOne(id);
  }

  @Get(':id/html')
  @Roles('super_admin', 'admin_smartclarity')
  renderHtml(@Param('id') id: string) {
    return this.newslettersService.renderHtml(id);
  }

  @Post()
  @RequiereAccion('noticias', 'crear')
  create(@Body() dto: CreateNewsletterDto, @Req() req: Request) {
    const user = req.user as UsuarioAutenticado;
    return this.newslettersService.create(dto, user.sub);
  }

  @Put(':id')
  @RequiereAccion('noticias', 'crear')
  update(@Param('id') id: string, @Body() dto: UpdateNewsletterDto) {
    return this.newslettersService.update(id, dto);
  }

  @Post(':id/imagenes')
  @RequiereAccion('noticias', 'crear')
  @UseInterceptors(FilesInterceptor('imagenes', 3, OPCIONES_SUBIDA))
  subirImagenes(
    @Param('id') id: string,
    @Query('bloque') bloque: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const bloqueIdx = Number(bloque);
    if (Number.isNaN(bloqueIdx)) {
      return this.newslettersService.subirImagenes(id, 0, files ?? []);
    }
    return this.newslettersService.subirImagenes(id, bloqueIdx, files ?? []);
  }

  @Delete(':id/imagenes/:imagenId')
  @RequiereAccion('noticias', 'crear')
  eliminarImagen(@Param('id') id: string, @Param('imagenId') imagenId: string) {
    return this.newslettersService.eliminarImagen(id, imagenId);
  }

  @Post(':id/prueba')
  @RequiereAccion('noticias', 'crear')
  enviarPrueba(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as UsuarioAutenticado;
    return this.newslettersService.enviarPrueba(id, user);
  }

  @Post(':id/solicitar-aprobacion')
  @RequiereAccion('noticias', 'crear')
  solicitarAprobacion(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as UsuarioAutenticado;
    return this.newslettersService.solicitarAprobacion(id, user);
  }

  @Post(':id/aprobar')
  @Roles('super_admin')
  aprobar(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as UsuarioAutenticado;
    return this.newslettersService.aprobar(id, user);
  }

  @Post(':id/rechazar')
  @Roles('super_admin')
  rechazar(
    @Param('id') id: string,
    @Body() dto: RechazarNewsletterDto,
    @Req() req: Request,
  ) {
    const user = req.user as UsuarioAutenticado;
    return this.newslettersService.rechazar(id, dto, user);
  }

  @Post(':id/enviar')
  @RequiereAccion('noticias', 'crear')
  enviarATodos(@Param('id') id: string) {
    return this.newslettersService.enviarATodos(id);
  }

  @Delete(':id')
  @RequiereAccion('noticias', 'eliminar')
  remove(@Param('id') id: string) {
    return this.newslettersService.remove(id);
  }

  // ── Buzón de sugerencias ──────────────────────────────────────────────────

  @Post('sugerencias')
  @Roles('super_admin', 'admin_smartclarity')
  crearSugerencia(@Body() dto: { mensaje: string; categoria?: string }, @Req() req: Request) {
    const user = req.user as UsuarioAutenticado;
    return this.newslettersService.crearSugerencia(dto, user);
  }

  @Delete('sugerencias/:id')
  @Roles('super_admin')
  eliminarSugerencia(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as UsuarioAutenticado;
    return this.newslettersService.eliminarSugerencia(id, user.rol);
  }
}
