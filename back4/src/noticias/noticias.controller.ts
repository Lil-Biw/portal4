import {
  Controller, Get, Post, Put, Delete, Param, Body,
  UseInterceptors, UploadedFile, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OPCIONES_SUBIDA } from '../common/constants/upload.constants';
import { Response } from 'express';
import { NoticiasService } from './noticias.service';
import { CreateNoticiaDto } from './noticias.dto';
import { Public, RequiereAccion } from '../common/guards/guards';

@Controller('noticias')
export class NoticiasController {
  constructor(private readonly noticiasService: NoticiasService) {}

  @Get()
  findAll() {
    return this.noticiasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.noticiasService.findOne(id);
  }

  @Get(':id/imagen')
  @Public()
  async getImagen(@Param('id') id: string, @Res() res: Response) {
    const { data, mimetype } = await this.noticiasService.getImagen(id);
    res.setHeader('Content-Type', mimetype);
    res.send(data);
  }

  @Post()
  @RequiereAccion('noticias', 'crear')
  create(@Body() dto: CreateNoticiaDto) {
    return this.noticiasService.create(dto);
  }

  @Put(':id')
  @RequiereAccion('noticias', 'crear')
  update(@Param('id') id: string, @Body() dto: CreateNoticiaDto) {
    return this.noticiasService.update(id, dto);
  }

  @Post(':id/imagen')
  @RequiereAccion('noticias', 'crear')
  @UseInterceptors(FileInterceptor('imagen', OPCIONES_SUBIDA))
  subirImagen(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.noticiasService.subirImagen(id, file);
  }

  @Delete(':id')
  @RequiereAccion('noticias', 'eliminar')
  remove(@Param('id') id: string) {
    return this.noticiasService.remove(id);
  }
}
