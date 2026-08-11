import { Component, OnInit, inject, signal, computed, effect, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ClientesService } from '../clientes.service';
import { AuthService } from '../../auth/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { ClienteFormComponent } from '../components/cliente-form/cliente-form.component';
import { ClientesListComponent } from '../components/clientes-list/clientes-list.component';
import { Cliente, CreateClienteDto } from '../../../shared/models/cliente.model';
import { ProfileService } from '../../../profile/profile.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { SpiderChartComponent } from '../../../shared/components/spider-chart/spider-chart.component';
import { Solicitud } from '../../solicitudes/solicitudes.service';
import { asId, calcularScoreDocumental } from '../../../shared/utils';

type ModalMode = 'crear' | 'editar' | 'buscar' | 'score' | null;

@Component({
  selector: 'app-clientes-page',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent, ClienteFormComponent, ClientesListComponent, SpiderChartComponent],
  templateUrl: './clientes-page.component.html',
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }
    .page-header h2 {
      margin: 0 0 .2rem;
      font-size: 1.5rem;
      font-weight: 800;
      color: #111827;
    }
    .page-subtitle {
      margin: 0;
      font-size: .83rem;
      color: #6b7280;
    }
    .header-actions { display: flex; gap: .6rem; align-items: center; }
    .btn-buscar {
      display: flex; align-items: center; gap: .4rem;
    }

    /* Modal overlay */
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

    /* Buscar */
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
export class ClientesPageComponent implements OnInit {
  protected readonly service              = inject(ClientesService);
  private  readonly profileService        = inject(ProfileService);
  private  readonly consumidorContext     = inject(ConsumidorContextService);
  private  readonly router                = inject(Router);
  private  readonly authService           = inject(AuthService);
  private  readonly http                  = inject(HttpClient);
  private  readonly api                   = inject(ApiService);

  private  readonly todasSolicitudes   = signal<Solicitud[]>([]);
  private  readonly docsPorEmpresa     = signal<Map<string, number>>(new Map());
  private  readonly loadingDocs        = signal(false);

  protected readonly scoresPorEmpresa = computed((): Map<string, number> => {
    const sols = this.todasSolicitudes();
    const docs = this.docsPorEmpresa();
    const map = new Map<string, number>();
    for (const emp of this.service.clientes()) {
      const id = asId(emp._id);
      const empSols     = sols.filter(s => asId(s.empresa_id) === id);
      const docsActivos = docs.get(id) ?? 0;
      if (empSols.length === 0 && docsActivos === 0) continue;
      map.set(id, calcularScoreDocumental(empSols, docsActivos).pct);
    }
    return map;
  });

  constructor() {
    effect(() => {
      const clientes = this.service.clientes();
      if (clientes.length > 0) {
        untracked(() => {
          this.cargarSolicitudesGlobal(clientes.map(c => asId(c._id)));
          this.cargarDocsPorEmpresa(clientes.map(c => asId(c._id)));
        });
      }
    });
  }

  private cargarSolicitudesGlobal(clienteIds: string[]): void {
    if (this.loadingDocs()) return;
    this.loadingDocs.set(true);
    const reqs = clienteIds.map(id =>
      this.http.get<Solicitud[] | { data: Solicitud[] }>(this.api.url(`/empresas/${id}/solicitudes`))
        .pipe(catchError(() => of([] as Solicitud[])))
    );
    forkJoin(reqs).subscribe(resultados => {
      this.todasSolicitudes.set(resultados.flatMap(r => Array.isArray(r) ? r : r.data));
      this.loadingDocs.set(false);
    });
  }

  private cargarDocsPorEmpresa(clienteIds: string[]): void {
    const reqs = clienteIds.map(id =>
      this.http.get<unknown[]>(this.api.url(`/empresas/${id}/documentos`))
        .pipe(catchError(() => of([] as unknown[])))
    );
    forkJoin(reqs).subscribe(resultados => {
      const map = new Map<string, number>();
      clienteIds.forEach((id, i) => map.set(id, resultados[i].length));
      this.docsPorEmpresa.set(map);
    });
  }

  protected modal            = signal<ModalMode>(null);
  protected busqueda         = signal('');
  protected pendingLogo      = signal<File | null>(null);
  protected pendingImagen    = signal<File | null>(null);
  protected clienteParaScore = signal<Cliente | null>(null);
  protected valoresScoreEdit = signal<number[]>([5, 5, 5, 5, 5]);
  protected guardandoScore   = signal(false);
  protected scoreError       = signal<string | null>(null);
  protected mostrarPromedioEdit = signal(false);
  protected guardandoPromedio   = signal(false);

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

  protected esAdminCliente = computed(() => this.authService.usuarioActual()?.rol === 'admin_smartclarity');

  protected clientesFiltrados = computed(() => {
    const base = this.service.clientes();
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return base;
    return base.filter(c =>
      c.razon_social.toLowerCase().includes(q) ||
      c.rut.toLowerCase().includes(q) ||
      c.email_contacto.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.service.cargar();
  }

  protected abrirCrear(): void {
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.pendingLogo.set(null);
    this.pendingImagen.set(null);
    this.modal.set('crear');
  }

  protected abrirBuscar(): void {
    this.busqueda.set('');
    this.service.clearStatus();
    this.modal.set('buscar');
  }

  protected abrirEditar(cliente: Cliente): void {
    this.service.seleccionar(cliente);
    this.pendingLogo.set(null);
    this.pendingImagen.set(null);
    this.modal.set('editar');
  }

  protected cerrar(): void {
    this.modal.set(null);
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.pendingLogo.set(null);
    this.pendingImagen.set(null);
    this.clienteParaScore.set(null);
    this.guardandoScore.set(false);
    this.scoreError.set(null);
  }

  protected abrirEditarScore(cliente: Cliente): void {
    this.clienteParaScore.set(cliente);
    const raw = cliente.score_smartclarity;
    this.valoresScoreEdit.set(raw && raw.length === 5 ? [...raw] : [5, 5, 5, 5, 5]);
    this.mostrarPromedioEdit.set(cliente.mostrar_grafico_promedio ?? false);
    this.scoreError.set(null);
    this.modal.set('score');
  }

  protected setValorScore(index: number, value: number): void {
    this.valoresScoreEdit.update(v => { const c = [...v]; c[index] = value; return c; });
    this.scoreError.set(null);
  }

  protected guardarScore(): void {
    const cliente = this.clienteParaScore();
    if (!cliente) return;
    const vals = this.valoresScoreEdit();
    if (vals.some(v => !Number.isInteger(v) || v < 1 || v > 10)) {
      this.scoreError.set('Rango permitido: 1 a 10 números naturales.');
      return;
    }
    this.guardandoScore.set(true);
    this.service.updateScoreSmartclarity(cliente._id, vals, (ok) => {
      this.guardandoScore.set(false);
      if (ok) this.cerrar();
    });
  }

  protected togglePromedio(): void {
    const cliente = this.clienteParaScore();
    if (!cliente) return;
    const nuevo = !this.mostrarPromedioEdit();
    this.guardandoPromedio.set(true);
    this.service.updateConfigGrafico(cliente._id, nuevo, () => {
      this.mostrarPromedioEdit.set(nuevo);
      this.guardandoPromedio.set(false);
    });
  }

  protected crear(dto: CreateClienteDto): void {
    this.service.crear(dto, this.pendingLogo(), this.pendingImagen());
    this.pendingLogo.set(null);
    this.pendingImagen.set(null);
  }

  protected actualizar(dto: CreateClienteDto): void {
    const id = this.service.seleccionado()?._id;
    if (id) this.service.actualizar(id, dto, this.pendingLogo(), this.pendingImagen());
    this.pendingLogo.set(null);
    this.pendingImagen.set(null);
  }

  protected eliminar(id: string): void {
    this.service.eliminar(id);
  }

  protected editarDesdeBuscar(cliente: Cliente): void {
    this.service.seleccionar(cliente);
    this.pendingLogo.set(null);
    this.pendingImagen.set(null);
    this.modal.set('editar');
  }

  protected irAFicha(cliente: Cliente): void {
    this.consumidorContext.seleccionar(cliente);
    this.profileService.setMode('consumidor');
    this.router.navigate(['/mi-ficha']);
  }

}
