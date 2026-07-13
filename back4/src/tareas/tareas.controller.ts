import { Controller, Post, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/guards/guards';
import { ProyectosService } from '../proyectos/proyectos.service';
import { ActividadesService } from '../actividades/actividades.service';

// Endpoints invocados por un disparador externo (Vercel Cron u otro
// programador), no por usuarios del portal. Protegidos con CRON_SECRET en
// vez de JWT porque el llamador no tiene sesión de usuario.
// En despliegues con proceso persistente (EC2/Railway) el disparo lo hace
// TareasService (CRON_INTERNO=true) y estos endpoints quedan solo para
// pruebas manuales.
@Controller('tareas')
export class TareasController {
  private readonly logger = new Logger(TareasController.name);

  constructor(
    private readonly proyectosService: ProyectosService,
    private readonly actividadesService: ActividadesService,
    private readonly config: ConfigService,
  ) {}

  private verificarSecret(authHeader?: string): void {
    const secret = this.config.get<string>('CRON_SECRET');
    if (secret && authHeader !== `Bearer ${secret}`) {
      throw new UnauthorizedException();
    }
  }

  @Public()
  @Post('recordatorios-proyectos')
  async recordatoriosProyectos(@Headers('authorization') authHeader?: string) {
    this.verificarSecret(authHeader);
    const resultado = await this.proyectosService.enviarRecordatoriosVencimiento();
    this.logger.log(`Recordatorios de vencimiento de proyectos: ${resultado.notificados}/${resultado.evaluados} notificados, ${resultado.cerrados} cerrados por vencimiento`);
    return resultado;
  }

  @Public()
  @Post('recordatorios-actividades')
  async recordatoriosActividades(@Headers('authorization') authHeader?: string) {
    this.verificarSecret(authHeader);
    const resultado = await this.actividadesService.enviarRecordatoriosVencimiento();
    this.logger.log(`Recordatorios de actividades: ${resultado.notificados}/${resultado.evaluados} notificados`);
    return resultado;
  }
}
