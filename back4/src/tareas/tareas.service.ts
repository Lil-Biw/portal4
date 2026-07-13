import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ProyectosService } from '../proyectos/proyectos.service';
import { ActividadesService } from '../actividades/actividades.service';

// Cron interno para despliegues con proceso persistente (EC2/Railway), donde
// no existe Vercel Cron ni conviene depender de un crontab del sistema.
// Se habilita con CRON_INTERNO=true en el .env; en Vercel debe quedar apagado
// (serverless: el timer del proceso no es confiable y duplicaría los envíos
// con el cron de vercel.json). Con una sola instancia habilitada no hay
// duplicados; la marca ultimo_recordatorio_dias protege además contra
// corridas repetidas el mismo día.
@Injectable()
export class TareasService {
  private readonly logger = new Logger(TareasService.name);

  constructor(
    private readonly proyectosService: ProyectosService,
    private readonly actividadesService: ActividadesService,
    private readonly config: ConfigService,
  ) {}

  // Cada hora en punto: así un proyecto/actividad creado hoy que ya cruzó un
  // umbral recibe su aviso el mismo día, y el auto-cierre ocurre en la primera
  // corrida tras la medianoche chilena. No repite avisos: los services calculan
  // los días con la fecha de Chile (hoyUtcChile) y la marca
  // ultimo_recordatorio_dias descarta umbrales ya notificados.
  @Cron('0 0 * * * *')
  async recordatoriosCadaHora(): Promise<void> {
    if (this.config.get<string>('CRON_INTERNO') !== 'true') return;

    try {
      const pro = await this.proyectosService.enviarRecordatoriosVencimiento();
      this.logger.log(`Cron interno — proyectos: ${pro.notificados}/${pro.evaluados} notificados, ${pro.cerrados} cerrados por vencimiento`);
    } catch (err) {
      this.logger.error('Cron interno — recordatorios de proyectos fallaron', err instanceof Error ? err.stack : String(err));
    }

    try {
      const act = await this.actividadesService.enviarRecordatoriosVencimiento();
      this.logger.log(`Cron interno — actividades: ${act.notificados}/${act.evaluados} notificados`);
    } catch (err) {
      this.logger.error('Cron interno — recordatorios de actividades fallaron', err instanceof Error ? err.stack : String(err));
    }
  }
}
