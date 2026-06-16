import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TipoActivoSchema } from './tipos-activo.schema';
import { TiposActivoController } from './tipos-activo.controller';
import { TiposActivoService } from './tipos-activo.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'TipoActivo', schema: TipoActivoSchema }]),
  ],
  controllers: [TiposActivoController],
  providers: [TiposActivoService],
  exports: [TiposActivoService],
})
export class TiposActivoModule {}
