import { Component, inject, effect, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NoticiasService } from '../noticias.service';
import { NewslettersService } from '../newsletters.service';
import { NewslettersAdminPanelComponent } from './newsletters-admin-panel.component';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { SECCIONES, SeccionNoticia, Noticia } from '../../../shared/models/noticia.model';
import { NEWSLETTER_COLOR, CATEGORIAS_SUGERENCIA } from '../../../shared/models/newsletter.model';
import { AuthService } from '../../auth/auth.service';
import { confirmarEliminacion } from '../../../shared/utils';

type TabNoticias = 'newsletters' | SeccionNoticia | 'sugerencias';

@Component({
  selector: 'app-noticias-admin-page',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent, NewslettersAdminPanelComponent],
  templateUrl: './noticias-admin-page.component.html',
  styleUrl: './noticias-admin-page.component.css',
})
export class NoticiasAdminPageComponent implements OnInit {
  protected readonly service            = inject(NoticiasService);
  protected readonly newslettersService = inject(NewslettersService);
  protected readonly authService        = inject(AuthService);
  private readonly route                = inject(ActivatedRoute);
  protected readonly secciones = SECCIONES;

  protected readonly tabs: { value: TabNoticias; label: string; color: string; nota: string }[] = [
    { value: 'newsletters', label: 'Newsletters', color: NEWSLETTER_COLOR, nota: 'Solo personal interno' },
    { value: 'novedades',   label: 'Novedades',   color: '#00AEEF',         nota: 'A todos los usuarios' },
    { value: 'normativas',  label: 'Normativas',  color: '#F5A524',         nota: 'A todos los usuarios' },
    { value: 'anuncios',    label: 'Anuncios',    color: '#2EAE6E',         nota: 'A todos los usuarios' },
  ];

  protected readonly tabSugerencias = { value: 'sugerencias' as TabNoticias, label: 'Sugerencias', color: '#7c3aed', nota: 'Buzón interno' };

  protected tabActiva = signal<TabNoticias>('newsletters');

  protected showModal     = signal(false);
  protected editandoId    = signal<string | null>(null);
  protected imagenPreview = signal<string | null>(null);
  protected imagenFile    = signal<File | null>(null);
  protected form = { titulo: '', enlace: '', resumen: '', seccion: 'novedades' as SeccionNoticia };

  protected sugerencia = { mensaje: '', categoria: 'Otro' };
  protected categoriasSugerencia = CATEGORIAS_SUGERENCIA;
  protected enviandoSugerencia = signal(false);
  protected eliminandoSugerenciaId = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.service.status()?.type === 'ok' && this.showModal()) {
        this.cerrarModal();
      }
    });
  }

  ngOnInit() {
    this.service.cargar();
    this.newslettersService.cargar();
    this.newslettersService.cargarSugerencias();

    const tab = this.route.snapshot.queryParamMap.get('tab') as TabNoticias | null;
    if (tab && (this.tabs.some(t => t.value === tab) || tab === this.tabSugerencias.value)) {
      this.seleccionarTab(tab);
    }
  }

  seleccionarTab(tab: TabNoticias): void {
    this.tabActiva.set(tab);
    if (tab !== 'newsletters' && tab !== 'sugerencias') {
      this.service.seccionActiva.set(tab);
    }
  }

  countTab(tab: TabNoticias): number {
    if (tab === 'newsletters') return this.newslettersService.newsletters().length;
    if (tab === 'sugerencias') return this.newslettersService.sugerencias().length;
    return this.service.noticias().filter(n => n.seccion === tab).length;
  }

  async enviarSugerencia(): Promise<void> {
    if (!this.sugerencia.mensaje.trim() || this.enviandoSugerencia()) return;
    this.enviandoSugerencia.set(true);
    try {
      await this.newslettersService.crearSugerencia(this.sugerencia.mensaje.trim(), this.sugerencia.categoria);
      this.sugerencia = { mensaje: '', categoria: 'Otro' };
    } finally {
      this.enviandoSugerencia.set(false);
    }
  }

  async eliminarSugerencia(id: string): Promise<void> {
    if (!confirmarEliminacion('esta sugerencia') || this.eliminandoSugerenciaId()) return;
    this.eliminandoSugerenciaId.set(id);
    try {
      await this.newslettersService.eliminarSugerencia(id);
    } finally {
      this.eliminandoSugerenciaId.set(null);
    }
  }

  get esSuperAdmin() {
    return this.authService.usuarioActual()?.rol === 'super_admin';
  }

  formatFechaSugerencia(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  get seccionActual() {
    return this.secciones.find(s => s.value === this.service.seccionActiva())!;
  }

  abrirModal() {
    this.service.clearStatus();
    this.form = { titulo: '', enlace: '', resumen: '', seccion: this.service.seccionActiva() };
    this.imagenFile.set(null);
    this.imagenPreview.set(null);
    this.editandoId.set(null);
    this.showModal.set(true);
  }

  abrirEditar(event: MouseEvent, noticia: Noticia): void {
    event.stopPropagation();
    this.service.clearStatus();
    this.form = { titulo: noticia.titulo, enlace: noticia.enlace, resumen: noticia.resumen, seccion: noticia.seccion };
    this.imagenFile.set(null);
    this.imagenPreview.set(null);
    this.editandoId.set(noticia._id);
    this.showModal.set(true);
  }

  cerrarModal() { this.showModal.set(false); this.editandoId.set(null); }

  formValido(): boolean {
    return this.form.titulo.trim().length >= 2
      && this.form.enlace.trim().length >= 5
      && this.form.resumen.trim().length >= 5;
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.imagenFile.set(file);
    const reader = new FileReader();
    reader.onload = e => this.imagenPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  guardar(): void {
    if (!this.formValido()) return;
    const dto = { titulo: this.form.titulo.trim(), enlace: this.form.enlace.trim(), resumen: this.form.resumen.trim(), seccion: this.form.seccion };
    const id = this.editandoId();
    if (id) {
      this.service.actualizar(id, dto);
    } else {
      this.service.crear(dto, this.imagenFile() ?? undefined);
    }
  }

  eliminar(event: MouseEvent, id: string): void {
    event.stopPropagation();
    const noticia = this.service.noticias().find(n => n._id === id);
    if (noticia && !confirmarEliminacion(noticia.titulo)) return;
    this.service.eliminar(id);
  }

  seccionColor(seccion: SeccionNoticia): string {
    return this.secciones.find(s => s.value === seccion)?.color ?? '#00AEEF';
  }

  seccionLabel(seccion: SeccionNoticia): string {
    return this.secciones.find(s => s.value === seccion)?.labelMin ?? seccion;
  }

  abrirEnlace(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  formatFecha(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
}
