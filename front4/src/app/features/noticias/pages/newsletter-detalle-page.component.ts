import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NewslettersService } from '../newsletters.service';
import { Newsletter } from '../../../shared/models/newsletter.model';

@Component({
  selector: 'app-newsletter-detalle-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './newsletter-detalle-page.component.html',
  styleUrl: './newsletter-detalle-page.component.css',
})
export class NewsletterDetallePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(NewslettersService);

  protected readonly newsletter = signal<Newsletter | null>(null);
  protected readonly cargando = signal(true);
  protected readonly noEncontrado = signal(false);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.noEncontrado.set(true);
      this.cargando.set(false);
      return;
    }

    const newsletter = await this.service.obtener(id);
    this.newsletter.set(newsletter);
    this.noEncontrado.set(!newsletter);
    this.cargando.set(false);
  }

  parrafos(cuerpo: string): string[] {
    return cuerpo.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  }

  imagenUrl(url: string): string {
    return this.service.imagenUrl(url);
  }
}
