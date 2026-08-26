import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NewslettersController } from './newsletters.controller';
import { NewslettersService } from './newsletters.service';
import { NewsletterSchema, NewsletterImagenSchema } from './newsletters.schema';
import { SugerenciaNewsletterSchema } from './sugerencias-newsletter.schema';
import { UsuarioSchema } from '../usuarios/usuarios.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Newsletter', schema: NewsletterSchema },
      { name: 'NewsletterImagen', schema: NewsletterImagenSchema },
      { name: 'SugerenciaNewsletter', schema: SugerenciaNewsletterSchema },
      { name: 'Usuario', schema: UsuarioSchema },
    ]),
    MailModule,
  ],
  controllers: [NewslettersController],
  providers: [NewslettersService],
  exports: [NewslettersService],
})
export class NewslettersModule {}
