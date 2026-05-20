import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TipoMantencionSchema } from './tipos-mantencion.schema';
import { TiposMantencionController } from './tipos-mantencion.controller';
import { TiposMantencionService } from './tipos-mantencion.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'TipoMantencion', schema: TipoMantencionSchema }]),
  ],
  controllers: [TiposMantencionController],
  providers: [TiposMantencionService],
  exports: [TiposMantencionService],
})
export class TiposMantencionModule {}
