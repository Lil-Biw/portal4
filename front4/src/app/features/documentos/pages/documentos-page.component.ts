import { Component, inject, computed } from '@angular/core';
import { ProfileService } from '../../../profile/profile.service';
import { DocumentosConsumidorPageComponent } from './documentos-consumidor-page.component';
import { DocumentosAdminPageComponent } from './documentos-admin-page.component';

@Component({
  selector: 'app-documentos-page',
  standalone: true,
  imports: [DocumentosConsumidorPageComponent, DocumentosAdminPageComponent],
  template: `
    @if (mode() === 'consumidor') {
      <app-documentos-consumidor-page></app-documentos-consumidor-page>
    } @else {
      <app-documentos-admin-page></app-documentos-admin-page>
    }
  `,
})
export class DocumentosPageComponent {
  private readonly profileService = inject(ProfileService);
  protected mode = computed(() => this.profileService.mode());
}
