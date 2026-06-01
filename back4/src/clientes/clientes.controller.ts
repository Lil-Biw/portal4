import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query,
  UseInterceptors, UploadedFile, BadRequestException, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ClientesService } from './clientes.service';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';
import { Roles } from '../common/guards/guards';

@Controller('empresas')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateClienteDto) {
    return this.clientesService.create(dto);
  }

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.clientesService.findAll(+page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientesService.findOne(id);
  }

  @Put(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.clientesService.remove(id);
  }

  @Post(':id/logo')
  @Roles('super_admin')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  subirLogo(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.clientesService.subirLogo(id, archivo);
  }

  @Get(':id/logo')
  async servirLogo(@Param('id') id: string, @Res() res: Response) {
    const { buffer, tipo_mime, nombre } = await this.clientesService.servirLogo(id);
    res.setHeader('Content-Type', tipo_mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"`);
    res.send(buffer);
  }
}
