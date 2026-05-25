import { Component, inject, computed } from '@angular/core';
import { ProfileService } from '../../../profile/profile.service';
import { NoticiasAdminPageComponent } from './noticias-admin-page.component';
import { NoticiasConsumidorPageComponent } from './noticias-consumidor-page.component';

@Component({
  selector: 'app-noticias-page',
  standalone: true,
  imports: [NoticiasAdminPageComponent, NoticiasConsumidorPageComponent],
  template: `
    @if (mode() === 'admin') {
      <app-noticias-admin-page></app-noticias-admin-page>
    } @else {
      <app-noticias-consumidor-page></app-noticias-consumidor-page>
    }
  `,
})
export class NoticiasPageComponent {
  private readonly profileService = inject(ProfileService);
  protected mode = computed(() => this.profileService.mode());
}
