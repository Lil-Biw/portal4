import { Component, OnInit, inject, signal, computed, effect, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin, catchError, of } from 'rxjs';
import { CentrosService } from '../centros.service';
import { ClientesService } from '../../clientes/clientes.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { CentroFormComponent } from '../components/centro-form/centro-form.component';
import { CentrosListComponent } from '../components/centros-list/centros-list.component';
import { CentroCosto, CreateCentroDto } from '../../../shared/models/centro.model';
import { ActivosService } from '../../activos/activos.service';
import { ActivosFormComponent } from '../../activos/components/activos-form/activos-form.component';
import { CreateActivoDto } from '../../../shared/models/activo.model';
import { asId } from '../../../shared/utils';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { ProfileService } from '../../../profile/profile.service';
import { AuthService } from '../../auth/auth.service';
import { SpiderChartComponent } from '../../../shared/components/spider-chart/spider-chart.component';
import { ApiService } from '../../../core/services/api.service';
import { Solicitud } from '../../solicitudes/solicitudes.service';

type ModalMode = 'crear' | 'editar' | 'buscar' | 'activo' | 'score' | null;

@Component({
  selector: 'app-centros-page',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent, CentroFormComponent, CentrosListComponent, ActivosFormComponent, SpiderChartComponent],
  templateUrl: './centros-page.component.html',
  styles: [`
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }
    .page-header h2 { margin: 0 0 .2rem; font-size: 1.5rem; font-weight: 700; color: #1f2937; }
    .page-subtitle { margin: 0; font-size: .875rem; color: #6b7280; }
    .header-actions { display: flex; gap: .6rem; align-items: center; }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15,23,42,.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1rem;
    }
    .modal {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15,23,42,.18);
      width: 100%;
      max-width: 640px;
      max-height: 85vh;
      overflow-y: auto;
      padding: 1.5rem;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .modal-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .modal-close {
      background: none;
      border: none;
      font-size: 1.4rem;
      line-height: 1;
      cursor: pointer;
      color: #6b7280;
      padding: 0 .25rem;
    }
    .modal-close:hover { color: #1f2937; }
    .search-input {
      width: 100%;
      padding: .65rem .9rem;
      border-radius: 8px;
      border: 1px solid rgba(34,33,33,.2);
      font-size: .9rem;
      font-family: inherit;
      margin-bottom: 1rem;
      box-sizing: border-box;
    }
    .search-input:focus { outline: none; border-color: #0095d6; }
  `],
})
export class CentrosPageComponent implements OnInit {
  protected readonly service           = inject(CentrosService);
  protected readonly clientesService   = inject(ClientesService);
  private   readonly consumidorContext = inject(ConsumidorContextService);
  private   readonly profileService    = inject(ProfileService);
  private   readonly router            = inject(Router);
  protected readonly activosService    = inject(ActivosService);
  private   readonly authService       = inject(AuthService);
  private   readonly http              = inject(HttpClient);
  private   readonly api               = inject(ApiService);

  private todasSolicitudes = signal<Solicitud[]>([]);

  protected scoresPorCentro = computed((): Map<string, number> => {
    const map = new Map<string, number>();
    const sols = this.todasSolicitudes();
    const centroIds = [...new Set(sols.map(s => s.centro_costo_id).filter(Boolean) as string[])];
    for (const centroId of centroIds) {
      const del = sols.filter(s => s.centro_costo_id === centroId);
      if (del.length === 0) continue;
      const aprobados = del.filter(s => s.estado === 'aprobado').length;
      map.set(centroId, Math.round(aprobados / del.length * 100));
    }
    return map;
  });

  protected modal            = signal<ModalMode>(null);
  protected busqueda         = signal('');
  protected centroParaActivo = signal<CentroCosto | null>(null);
  protected centroParaScore  = signal<CentroCosto | null>(null);
  protected valoresScoreEdit = signal<number[]>([5, 5, 5, 5, 5]);
  protected guardandoScore   = signal(false);
  protected scoreError       = signal<string | null>(null);

  readonly spiderLabels = [
    'RRHH y\ndocumentación',
    'Normativa',
    'Suministro',
    'Seguridad\nOperacional',
    'Continuidad\nOperacional',
  ];

  protected spiderPreviewValues = computed<number[]>(() =>
    this.valoresScoreEdit().map(v => v * 10)
  );

  protected scoreHayError = computed(() =>
    this.valoresScoreEdit().some(v => !Number.isInteger(v) || v < 1 || v > 10)
  );

  protected campoFuera(v: number): boolean {
    return !Number.isInteger(v) || v < 1 || v > 10;
  }

  constructor() {
    effect(() => {
      if (this.activosService.status()?.type === 'ok' && this.modal() === 'activo') {
        this.cerrar();
      }
    });
    effect(() => {
      const clientes = this.clientesService.clientes();
      if (clientes.length > 0) {
        untracked(() => this.cargarSolicitudesGlobal(clientes.map(c => asId(c._id))));
      }
    });
  }

  private cargarSolicitudesGlobal(clienteIds: string[]): void {
    const reqs = clienteIds.map(id =>
      this.http.get<Solicitud[]>(this.api.url(`/empresas/${id}/solicitudes`))
        .pipe(catchError(() => of([] as Solicitud[])))
    );
    forkJoin(reqs).subscribe(resultados => {
      this.todasSolicitudes.set(resultados.flat());
    });
  }

  protected centrosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.service.centros();
    return this.service.centros().filter(c => {
      const empresa = this.clientesService.clientes()
        .find(x => asId(x._id) === asId(c.cliente_id))?.razon_social ?? '';
      return c.nombre.toLowerCase().includes(q) ||
             c.codigo.toLowerCase().includes(q) ||
             empresa.toLowerCase().includes(q);
    });
  });

  ngOnInit(): void {
    this.service.cargar();
    this.clientesService.cargar();
  }

  protected abrirCrear(): void {
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.modal.set('crear');
  }

  protected abrirBuscar(): void {
    this.busqueda.set('');
    this.service.clearStatus();
    this.modal.set('buscar');
  }

  protected abrirEditar(centro: CentroCosto): void {
    this.service.seleccionar(centro);
    this.modal.set('editar');
  }

  protected cerrar(): void {
    this.modal.set(null);
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.centroParaActivo.set(null);
    this.activosService.clearStatus();
    this.centroParaScore.set(null);
    this.guardandoScore.set(false);
    this.scoreError.set(null);
  }

  protected abrirAgregarActivo(centro: CentroCosto): void {
    this.centroParaActivo.set(centro);
    this.activosService.clearStatus();
    this.modal.set('activo');
  }

  protected crearActivo(dto: CreateActivoDto): void {
    this.activosService.crear(dto);
  }

  protected abrirEditarScore(centro: CentroCosto): void {
    this.centroParaScore.set(centro);
    const raw = centro.score_smartclarity;
    this.valoresScoreEdit.set(raw && raw.length === 5 ? [...raw] : [5, 5, 5, 5, 5]);
    this.scoreError.set(null);
    this.modal.set('score');
  }

  protected setValorScore(index: number, value: number): void {
    this.valoresScoreEdit.update(v => { const c = [...v]; c[index] = value; return c; });
    this.scoreError.set(null);
  }

  protected guardarScore(): void {
    const centro = this.centroParaScore();
    if (!centro) return;
    const vals = this.valoresScoreEdit();
    if (vals.some(v => !Number.isInteger(v) || v < 1 || v > 10)) {
      this.scoreError.set('Rango permitido: 1 a 10 números naturales.');
      return;
    }
    this.guardandoScore.set(true);
    this.service.updateScoreSmartclarity(String(centro.cliente_id), centro._id, vals, (ok) => {
      this.guardandoScore.set(false);
      if (ok) this.cerrar();
    });
  }

  protected crear(dto: CreateCentroDto): void   { this.service.crear(dto); }

  protected actualizar(dto: CreateCentroDto): void {
    const id = this.service.seleccionado()?._id;
    if (id) this.service.actualizar(id, dto);
  }

  protected eliminar(id: string): void {
    const centro = this.service.centros().find(c => c._id === id);
    if (centro) this.service.seleccionar(centro);
    this.service.eliminar(id);
  }

  protected irACentro(centro: CentroCosto): void {
    const empresa = this.clientesService.clientes()
      .find(c => asId(c._id) === asId(centro.cliente_id));
    if (!empresa) return;
    this.consumidorContext.seleccionar(empresa);
    this.consumidorContext.seleccionarCentro(centro);
    this.profileService.setMode('consumidor');
    this.router.navigate(['/mis-centros']);
  }

  protected editarDesdeBuscar(centro: CentroCosto): void {
    this.service.seleccionar(centro);
    this.modal.set('editar');
  }
}
