import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NoticiasController } from './noticias.controller';
import { NoticiasService } from './noticias.service';
import { NoticiaSchema } from './noticias.schema';
import { UsuarioSchema } from '../usuarios/usuarios.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Noticia', schema: NoticiaSchema },
      { name: 'Usuario', schema: UsuarioSchema },
    ]),
    MailModule,
  ],
  controllers: [NoticiasController],
  providers: [NoticiasService],
  exports: [NoticiasService],
})
export class NoticiasModule {}
