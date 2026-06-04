import { Component, OnInit, inject, signal, effect, computed, untracked } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { MantencionesService } from '../../mantenciones/mantenciones.service';
import { NoticiasService } from '../../noticias/noticias.service';
import { ApiService } from '../../../core/services/api.service';
import { Solicitud } from '../../solicitudes/solicitudes.service';
import { CentroCosto } from '../../../shared/models/centro.model';
import { Proyecto } from '../../../shared/models/proyecto.model';
import { asId } from '../../../shared/utils';

interface CentroResumen {
  centro: CentroCosto;
  total: number;
  proyectos: { proyecto: Proyecto; total: number }[];
}

interface EmpresaResumen {
  nombre: string;
  total: number;
  centros: CentroResumen[];
}

@Component({
  selector: 'app-resumen-page',
  standalone: true,
  imports: [SlicePipe],
  templateUrl: './resumen-page.component.html',
})
export class ResumenPageComponent implements OnInit {
  protected readonly clientesService     = inject(ClientesService);
  protected readonly centrosService      = inject(CentrosService);
  protected readonly proyectosService    = inject(ProyectosService);
  protected readonly usuariosService     = inject(UsuariosService);
  protected readonly mantencionesService = inject(MantencionesService);
  protected readonly noticiasService     = inject(NoticiasService);
  private  readonly http                 = inject(HttpClient);
  private  readonly api                  = inject(ApiService);

  protected todasSolicitudes  = signal<Solicitud[]>([]);
  protected loadingDocs       = signal(false);

  protected get docsAprobados()  { return this.todasSolicitudes().filter(s => s.estado === 'aprobado').length; }
  protected get docsRevision()   { return this.todasSolicitudes().filter(s => s.estado === 'revision').length; }
  protected get docsVencidos()   { return this.todasSolicitudes().filter(s => s.estado === 'vencido').length; }
  protected get docsRechazados() { return this.todasSolicitudes().filter(s => s.estado === 'rechazado').length; }
  protected get docsPendientes() { return this.todasSolicitudes().filter(s => s.estado === 'pendiente').length; }
  protected get docsPct() {
    const t = this.todasSolicitudes().length;
    return t > 0 ? Math.round((this.docsAprobados / t) * 100) : 0;
  }

  protected resumenEmpresas = computed((): EmpresaResumen[] => {
    const sols = this.todasSolicitudes();
    return this.clientesService.clientes().map(emp => {
      const empId   = asId(emp._id);
      const empSols = sols.filter(s => asId(s.empresa_id) === empId);

      const centros: CentroResumen[] = this.centrosService.centros()
        .filter(c => asId(c.cliente_id) === empId)
        .map(c => {
          const cId    = asId(c._id);
          const cSols  = sols.filter(s => asId(s.centro_costo_id) === cId);
          const proyectos = this.proyectosService.proyectos()
            .filter(p => asId(p.centro_costo_id) === cId)
            .map(p => ({
              proyecto: p,
              total: sols.filter(s => asId(s.proyecto_id) === asId(p._id)).length,
            }))
            .filter(x => x.total > 0);
          return { centro: c, total: cSols.length, proyectos };
        })
        .filter(x => x.total > 0 || x.proyectos.length > 0);

      return { nombre: emp.razon_social, total: empSols.length, centros };
    }).filter(x => x.total > 0);
  });

  constructor() {
    effect(() => {
      const clientes = this.clientesService.clientes();
      if (clientes.length > 0) {
        untracked(() => this.cargarSolicitudesGlobal(clientes.map(c => asId(c._id))));
      }
    });
  }

  ngOnInit(): void {
    this.clientesService.cargar();
    this.centrosService.cargar();
    this.proyectosService.cargar();
    this.usuariosService.cargar();
    this.mantencionesService.cargar();
    this.noticiasService.cargar();
  }

  private cargarSolicitudesGlobal(clienteIds: string[]): void {
    if (this.loadingDocs()) return;
    this.loadingDocs.set(true);
    const reqs = clienteIds.map(id =>
      this.http.get<Solicitud[]>(this.api.url(`/empresas/${id}/solicitudes`))
        .pipe(catchError(() => of([] as Solicitud[])))
    );
    forkJoin(reqs).subscribe(resultados => {
      this.todasSolicitudes.set(resultados.flat());
      this.loadingDocs.set(false);
    });
  }

  refresh(): void {
    this.loadingDocs.set(false);
    this.todasSolicitudes.set([]);
    this.ngOnInit();
  }
}
