import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ProfileMode } from './profile.types';

const STORAGE_KEY = 'portal4_profile_mode';
const DEFAULT: ProfileMode = 'consumidor';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly _mode = signal<ProfileMode>(this.loadInitialMode());

  readonly mode = computed(() => this._mode());

  setMode(mode: ProfileMode): void {
    this._mode.set(mode);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }

  toggleMode(): void {
    this.setMode(this._mode() === 'admin' ? 'consumidor' : 'admin');
  }

  private loadInitialMode(): ProfileMode {
    if (!isPlatformBrowser(this.platformId)) return DEFAULT;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'admin' || stored === 'consumidor' ? stored : DEFAULT;
  }
}
