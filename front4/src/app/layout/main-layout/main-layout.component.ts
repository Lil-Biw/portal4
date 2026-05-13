import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopbarComponent } from '../topbar/topbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ProfileService } from '../../profile/profile.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, TopbarComponent, SidebarComponent],
  templateUrl: './main-layout.component.html',
  styles: [`
    :host { display:block; }
    .layout {
      display:grid;
      grid-template-rows:auto 1fr;
      min-height:100vh;
      background:#dde0e4;
      transition:background .3s;
    }
    .layout.admin      { background:#cfd2d6; }
    .layout.consumidor { background:#b8d8ef; }
    .topbar-wrap {
      padding:1rem 1rem 0;
      max-width:1440px;
      width:100%;
      margin:0 auto;
      box-sizing:border-box;
    }
    .page-wrap {
      padding:1rem;
      max-width:1440px;
      width:100%;
      margin:0 auto;
      box-sizing:border-box;
    }
    .page {
      display:grid;
      grid-template-columns:220px 1fr;
      gap:1rem;
      align-items:start;
    }
    aside { position:sticky; top:1rem; }
    .content { min-width:0; }
  `],
})
export class MainLayoutComponent {
  protected readonly profileService = inject(ProfileService);

  protected get mode() { return this.profileService.mode; }
  protected toggleMode() { this.profileService.toggleMode(); }
}
