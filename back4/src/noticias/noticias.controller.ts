import {
  Controller, Get, Post, Delete, Param, Body,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { NoticiasService } from './noticias.service';
import { CreateNoticiaDto } from './noticias.dto';
import { Roles } from '../common/guards/guards';

@Controller('noticias')
export class NoticiasController {
  constructor(private readonly noticiasService: NoticiasService) {}

  @Get()
  findAll() {
    return this.noticiasService.findAll();
  }

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateNoticiaDto) {
    return this.noticiasService.create(dto);
  }

  @Post(':id/imagen')
  @Roles('super_admin')
  @UseInterceptors(FileInterceptor('imagen', { storage: memoryStorage() }))
  subirImagen(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.noticiasService.subirImagen(id, file);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.noticiasService.remove(id);
  }
}
