import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ClientesService } from './clientes.service';
import { CreateClienteDto, UpdateClienteDto, UpdateScoreSmartclarityDto, UpdateConfigGraficoDto } from './clientes.dto';
import { Roles, Public } from '../common/guards/guards';

interface JwtUser {
  sub: string;
  email: string;
  rol: string;
  cliente_id?: string;
}

@Controller('empresas')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  private assertEmpresaPermitida(user: JwtUser, empresaId: string) {
    if (user?.rol === 'super_admin' || user?.rol === 'admin_smartclarity') return;
    if (!user?.cliente_id || user.cliente_id !== empresaId) {
      throw new ForbiddenException('No puedes ver ni modificar otra empresa');
    }
  }

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateClienteDto) {
    return this.clientesService.create(dto);
  }

  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Req() req: Request,
  ) {
    const user = (req as any).user as JwtUser;
    if (user?.rol !== 'super_admin' && user?.rol !== 'admin_smartclarity') {
      if (!user?.cliente_id)
        throw new ForbiddenException('Tu usuario no tiene empresa asignada');
      const cliente = await this.clientesService.findOne(user.cliente_id);
      return { data: [cliente], total: 1, page: +page, pages: 1 };
    }
    return this.clientesService.findAll(+page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    this.assertEmpresaPermitida((req as any).user as JwtUser, id);
    return this.clientesService.findOne(id);
  }

  @Put(':id')
  @Roles('super_admin', 'admin_smartclarity')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientesService.update(id, dto);
  }

  @Put(':id/score-smartclarity')
  @Roles('super_admin', 'admin_smartclarity')
  updateScore(
    @Param('id') id: string,
    @Body() dto: UpdateScoreSmartclarityDto,
  ) {
    return this.clientesService.updateScoreSmartclarity(id, dto.valores);
  }

  @Patch(':id/config-grafico')
  @Roles('super_admin', 'admin_smartclarity')
  updateConfigGrafico(
    @Param('id') id: string,
    @Body() dto: UpdateConfigGraficoDto,
  ) {
    return this.clientesService.updateConfigGrafico(id, dto.mostrar_grafico_promedio);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.clientesService.remove(id);
  }

  @Post(':id/logo')
  @Roles('super_admin', 'admin_smartclarity')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  subirLogo(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.clientesService.subirLogo(id, archivo);
  }

  @Get(':id/logo')
  @Public()
  async servirLogo(@Param('id') id: string, @Res() res: Response) {
    const { buffer, tipo_mime, nombre } =
      await this.clientesService.servirLogo(id);
    res.setHeader('Content-Type', tipo_mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(nombre)}"`,
    );
    res.send(buffer);
  }

  @Post(':id/documentos')
  @Roles('super_admin', 'admin_smartclarity')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  subirDocumento(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
    @Body('categoria') categoria?: string,
    @Req() req?: Request,
  ) {
    this.assertEmpresaPermitida((req as any).user as JwtUser, id);
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.clientesService.agregarDocumento(
      id,
      archivo,
      nombreDisplay,
      categoria,
    );
  }

  @Get(':id/documentos')
  listarDocumentos(@Param('id') id: string, @Req() req: Request) {
    this.assertEmpresaPermitida((req as any).user as JwtUser, id);
    return this.clientesService.listarDocumentos(id);
  }

  @Get(':id/documentos/:docId')
  async descargarDocumento(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    this.assertEmpresaPermitida((req as any).user as JwtUser, id);
    const { buffer, tipo_mime, nombre_display } =
      await this.clientesService.servirDocumento(id, docId);
    res.setHeader('Content-Type', tipo_mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(nombre_display)}"`,
    );
    res.send(buffer);
  }

  @Delete(':id/documentos/:docId')
  @Roles('super_admin', 'admin_smartclarity')
  eliminarDocumento(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Req() req: Request,
  ) {
    this.assertEmpresaPermitida((req as any).user as JwtUser, id);
    return this.clientesService.eliminarDocumento(id, docId);
  }
}
