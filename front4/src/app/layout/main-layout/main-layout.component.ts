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
    :host { display:block; height:100vh; overflow:hidden; }
    .layout {
      display:grid;
      grid-template-columns:220px 1fr;
      grid-template-rows:60px 1fr;
      height:100vh;
      overflow:hidden;
      background: var(--bg-1);
    }
    aside {
      grid-column:1;
      grid-row:1 / 3;
      overflow-y:auto;
      height:100%;
    }
    header {
      grid-column:2;
      grid-row:1;
    }
    .content {
      grid-column:2;
      grid-row:2;
      padding:1.5rem 2rem;
      overflow-y:auto;
      min-width:0;
      background: var(--bg-1);
    }
  `],
})
export class MainLayoutComponent {
  protected readonly profileService = inject(ProfileService);

  protected get mode() { return this.profileService.mode; }
}
