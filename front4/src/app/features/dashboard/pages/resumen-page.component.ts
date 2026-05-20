import { Component, OnInit, inject } from '@angular/core';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { MantencionesService } from '../../mantenciones/mantenciones.service';

@Component({
  selector: 'app-resumen-page',
  standalone: true,
  imports: [],
  templateUrl: './resumen-page.component.html',
})
export class ResumenPageComponent implements OnInit {
  protected readonly clientesService     = inject(ClientesService);
  protected readonly centrosService      = inject(CentrosService);
  protected readonly proyectosService    = inject(ProyectosService);
  protected readonly usuariosService     = inject(UsuariosService);
  protected readonly mantencionesService = inject(MantencionesService);

  ngOnInit(): void {
    this.clientesService.cargar();
    this.centrosService.cargar();
    this.proyectosService.cargar();
    this.usuariosService.cargar();
    this.mantencionesService.cargar();
  }

  refresh(): void { this.ngOnInit(); }
}
