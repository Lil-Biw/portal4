import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { NewslettersService } from '../newsletters.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { AuthService } from '../../auth/auth.service';
import {
  Newsletter,
  ImagenNewsletter,
  BloqueNewsletterDto,
  EstadoNewsletter,
  ESTADO_LABEL,
  ESTADO_ICON,
} from '../../../shared/models/newsletter.model';
import { confirmarEliminacion } from '../../../shared/utils';

interface BloqueForm {
  titulo: string;
  cuerpo: string;
  archivos: File[];
  previews: string[];
  imagenesExistentes: ImagenNewsletter[];
}

function nuevoBloque(): BloqueForm {
  return { titulo: '', cuerpo: '', archivos: [], previews: [], imagenesExistentes: [] };
}

const EMOJIS = [
  '🎂','🎉','🥳','🎈','🎁','🎊',
  '💚','❤️','💙','🧡','💛','💜',
  '📢','📣','🔔','📰','📨','✉️',
  '🧠','💡','⚡','🔥','🚀','🌟',
  '❄️','🏔️','🌨️','☃️','🌎','🌍',
  '👏','🙌','👍','🙏','🤝','💪',
  '📅','📆','✅','❌','⚠️','❗',
  '🏆','🥇','🎖️','⭐','🌱','♻️',
  '🥪','☕','🍰','🍕','🍔','🥗',
  '😀','😃','😄','😁','😅','😂',
];

@Component({
  selector: 'app-newsletters-admin-panel',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent, NgTemplateOutlet],
  templateUrl: './newsletters-admin-panel.component.html',
  styleUrl: './newsletters-admin-panel.component.css',
})
export class NewslettersAdminPanelComponent implements OnInit {
  protected readonly service     = inject(NewslettersService);
  protected readonly authService = inject(AuthService);
  private readonly router        = inject(Router);

  protected showModal   = signal(false);
  protected editandoId  = signal<string | null>(null);
  protected form        = { titulo: '', tagline: '' };
  protected bloques     = signal<BloqueForm[]>([nuevoBloque()]);
  protected bloquesExpandidos = signal<boolean[]>([true]);
  protected imagenesEliminadas = signal<string[]>([]);

  protected emojiPicker = signal<{ id: string; tipo: 'input' | 'textarea' } | null>(null);
  protected emojiPickerPos = signal<{ top: number; left: number } | null>(null);
  protected emojis = EMOJIS;

  protected showRechazoModal = signal(false);
  protected rechazoId = signal<string | null>(null);
  protected motivoRechazo = '';

  protected guardando = signal(false);
  protected rechazando = signal(false);
  protected procesando = signal<string | null>(null);

  protected estadosLabel = ESTADO_LABEL;
  protected estadosIcon = ESTADO_ICON;

  ngOnInit() {
    this.service.cargar();
    this.service.cargarPendientesCount();
  }

  protected get usuario() { return this.authService.usuarioActual(); }
  protected get esSuperAdmin() { return this.usuario?.rol === 'super_admin'; }

  abrirModal() {
    this.service.clearStatus();
    this.form = { titulo: '', tagline: '' };
    this.bloques.set([nuevoBloque()]);
    this.bloquesExpandidos.set([true]);
    this.imagenesEliminadas.set([]);
    this.editandoId.set(null);
    this.showModal.set(true);
  }

  abrirEditar(event: MouseEvent, newsletter: Newsletter): void {
    event.stopPropagation();
    this.service.clearStatus();
    this.form = { titulo: newsletter.titulo, tagline: newsletter.tagline ?? '' };
    this.bloques.set(
      newsletter.bloques.length
        ? newsletter.bloques.map(b => ({
            titulo: b.titulo,
            cuerpo: b.cuerpo,
            archivos: [],
            previews: [],
            imagenesExistentes: b.imagenes ?? [],
          }))
        : [nuevoBloque()],
    );
    this.bloquesExpandidos.set(new Array(newsletter.bloques.length || 1).fill(false));
    this.imagenesEliminadas.set([]);
    this.editandoId.set(newsletter._id);
    this.showModal.set(true);
  }

  cerrarModal() { this.showModal.set(false); this.editandoId.set(null); }

  verDetalle(n: Newsletter): void {
    this.router.navigate(['/noticias/newsletters', n._id]);
  }

  toggleBloque(index: number) {
    this.bloquesExpandidos.update(list => {
      const copia = [...list];
      copia[index] = !copia[index];
      return copia;
    });
  }

  agregarBloque() {
    this.bloques.update(list => [...list, nuevoBloque()]);
    this.bloquesExpandidos.update(list => [...list, false]);
  }

  quitarBloque(index: number) {
    this.bloques.update(list => list.filter((_, i) => i !== index));
    this.bloquesExpandidos.update(list => list.filter((_, i) => i !== index));
  }

  moverBloque(index: number, dir: -1 | 1) {
    this.bloques.update(list => {
      const destino = index + dir;
      if (destino < 0 || destino >= list.length) return list;
      const copia = [...list];
      [copia[index], copia[destino]] = [copia[destino], copia[index]];
      return copia;
    });
    this.bloquesExpandidos.update(list => {
      const destino = index + dir;
      if (destino < 0 || destino >= list.length) return list;
      const copia = [...list];
      [copia[index], copia[destino]] = [copia[destino], copia[index]];
      return copia;
    });
  }

  onFileChange(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) return;

    const bloque = this.bloques()[index];
    const disponibles = 3 - bloque.imagenesExistentes.length - bloque.archivos.length;
    const seleccion = files.slice(0, Math.max(0, disponibles));

    seleccion.forEach(file => {
      const pos = bloque.archivos.length;
      bloque.archivos.push(file);
      bloque.previews.push('');
      const reader = new FileReader();
      reader.onload = e => {
        bloque.previews[pos] = e.target?.result as string;
        this.bloques.update(l => [...l]);
      };
      reader.readAsDataURL(file);
    });

    this.bloques.update(l => [...l]);
    input.value = '';
  }

  quitarArchivo(index: number, pos: number) {
    this.bloques.update(list => {
      const bloque = list[index];
      bloque.archivos = bloque.archivos.filter((_, i) => i !== pos);
      bloque.previews = bloque.previews.filter((_, i) => i !== pos);
      return [...list];
    });
  }

  quitarImagenExistente(index: number, imagenId: string) {
    this.bloques.update(list => {
      const bloque = list[index];
      bloque.imagenesExistentes = bloque.imagenesExistentes.filter(img => img._id !== imagenId);
      return [...list];
    });
    this.imagenesEliminadas.update(list => [...list, imagenId]);
  }

  formValido(): boolean {
    if (this.form.titulo.trim().length < 2) return false;
    const lista = this.bloques();
    if (lista.length === 0) return false;
    return lista.every(b => b.titulo.trim().length >= 2 && b.cuerpo.trim().length >= 2);
  }

  private dtoBloques(): BloqueNewsletterDto[] {
    return this.bloques().map(b => ({ titulo: b.titulo.trim(), cuerpo: b.cuerpo.trim() }));
  }

  private imagenesNuevas(): { bloque: number; files: File[] }[] {
    return this.bloques()
      .map((b, i) => ({ bloque: i, files: b.archivos }))
      .filter(x => x.files.length > 0);
  }

  async guardar(): Promise<void> {
    if (!this.formValido() || this.guardando()) return;
    const dto = {
      titulo: this.form.titulo.trim(),
      tagline: this.form.tagline.trim() || undefined,
      bloques: this.dtoBloques(),
    };

    const id = this.editandoId();
    this.guardando.set(true);
    try {
      const ok = id
        ? await this.service.actualizar(id, dto, this.imagenesNuevas(), this.imagenesEliminadas())
        : await this.service.crear(dto, this.imagenesNuevas());

      if (ok) this.cerrarModal();
    } finally {
      this.guardando.set(false);
    }
  }

  // ── Emoji picker ──────────────────────────────────────────────────────────

  abrirEmojiPicker(id: string, tipo: 'input' | 'textarea', event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.emojiPickerPos.set({ top: rect.bottom + 6, left: Math.max(8, rect.right - 280) });
    this.emojiPicker.set({ id, tipo });
  }

  cerrarEmojiPicker() {
    this.emojiPicker.set(null);
    this.emojiPickerPos.set(null);
  }

  insertarEmoji(emoji: string) {
    const picker = this.emojiPicker();
    if (!picker) return;
    const el = document.getElementById(picker.id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.setRangeText(emoji, start, end, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }

  // ── Acciones de envío/aprobación ──────────────────────────────────────────

  protected estaProcesando(id: string, accion: string): boolean {
    return this.procesando() === `${id}:${accion}`;
  }

  private async ejecutarAccion(id: string, accion: string, tarea: () => Promise<void>): Promise<void> {
    if (this.procesando()) return;
    this.procesando.set(`${id}:${accion}`);
    try {
      await tarea();
    } finally {
      this.procesando.set(null);
    }
  }

  async enviarPrueba(event: MouseEvent, id: string): Promise<void> {
    event.stopPropagation();
    this.service.clearStatus();
    await this.ejecutarAccion(id, 'prueba', () => this.service.enviarPrueba(id));
  }

  async accionEnviarATodos(event: MouseEvent, n: Newsletter): Promise<void> {
    event.stopPropagation();
    this.service.clearStatus();

    if (n.estado === 'aprobado') {
      if (!window.confirm(`¿Enviar "${n.titulo}" a todos los miembros de SmartClarity?`)) return;
      await this.ejecutarAccion(n._id, 'enviar', () => this.service.enviarATodos(n._id));
      return;
    }

    if (['borrador', 'rechazado'].includes(n.estado)) {
      const msg = n.estado === 'rechazado'
        ? 'El newsletter fue rechazado. Al solicitar aprobación se enviará una copia de prueba al super_admin aprobador.'
        : 'Se enviará una copia de prueba al super_admin aprobador para su revisión. ¿Continuar?';
      if (!window.confirm(msg)) return;
      await this.ejecutarAccion(n._id, 'enviar', () => this.service.solicitarAprobacion(n._id));
      return;
    }
  }

  async aprobar(event: MouseEvent, id: string): Promise<void> {
    event.stopPropagation();
    this.service.clearStatus();
    await this.ejecutarAccion(id, 'aprobar', () => this.service.aprobar(id));
  }

  abrirRechazo(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.service.clearStatus();
    this.rechazoId.set(id);
    this.motivoRechazo = '';
    this.showRechazoModal.set(true);
  }

  cerrarRechazo() { this.showRechazoModal.set(false); this.rechazoId.set(null); }

  async confirmarRechazo(): Promise<void> {
    const id = this.rechazoId();
    if (!id || !this.motivoRechazo.trim() || this.rechazando()) return;
    this.rechazando.set(true);
    try {
      await this.service.rechazar(id, this.motivoRechazo.trim());
      this.cerrarRechazo();
    } finally {
      this.rechazando.set(false);
    }
  }

  // ── Helpers visuales ──────────────────────────────────────────────────────

  estadoLabel(estado: EstadoNewsletter): string { return this.estadosLabel[estado]; }
  estadoIcon(estado: EstadoNewsletter): string { return this.estadosIcon[estado]; }

  esAprobador(n: Newsletter): boolean {
    const u = this.usuario;
    return !!u && u.rol === 'super_admin' && u.email.toLowerCase().trim() === n.aprobador_email?.toLowerCase().trim();
  }

  puedeEditar(n: Newsletter): boolean {
    return this.authService.tienePermiso('noticias', 'crear') && n.estado !== 'enviado';
  }

  puedeSolicitarAprobacion(n: Newsletter): boolean {
    return this.esSuperAdmin && ['borrador', 'rechazado'].includes(n.estado);
  }

  puedeEnviarATodos(n: Newsletter): boolean {
    return this.esSuperAdmin && n.estado === 'aprobado';
  }

  puedeAprobarRechazar(n: Newsletter): boolean {
    return this.esAprobador(n) && n.estado === 'pendiente_aprobacion';
  }

  enviarATodosLabel(n: Newsletter): string {
    if (n.estado === 'aprobado') return 'Enviar a todos (aprobado)';
    if (n.estado === 'pendiente_aprobacion') return 'Pendiente de aprobación';
    if (n.estado === 'rechazado') return 'Reenviar a aprobación';
    return 'Solicitar aprobación';
  }

  imagenUrl(url: string): string {
    return this.service.imagenUrl(url);
  }

  resumenCuerpo(cuerpo: string): string[] {
    return cuerpo
      .split(/\n\s*\n/)
      .filter(p => p.trim().length > 0)
      .slice(0, 3)
      .map(p => {
        const linea = p.replace(/\n/g, ' ').trim();
        return linea.length > 130 ? linea.slice(0, 130) + '…' : linea;
      });
  }

  totalImagenesBloque(b: BloqueForm): number {
    return b.imagenesExistentes.length + b.archivos.length;
  }

  async eliminarNewsletter(event: MouseEvent, id: string): Promise<void> {
    event.stopPropagation();
    if (!confirmarEliminacion('este newsletter')) return;
    await this.ejecutarAccion(id, 'eliminar', async () => { await this.service.eliminar(id); });
  }

  totalImagenesNewsletter(n: Newsletter): number {
    return n.bloques.reduce((acc, b) => acc + (b.imagenes?.length ?? 0), 0);
  }

  resumenNewsletter(n: Newsletter): string {
    const primerBloque = n.bloques?.[0]?.cuerpo ?? '';
    const limpio = primerBloque.replace(/\n+/g, ' ').trim();
    if (limpio.length === 0) return '';
    return limpio.length > 140 ? limpio.slice(0, 140) + '…' : limpio;
  }

  formatFecha(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
