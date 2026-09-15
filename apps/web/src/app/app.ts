import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';

type ApiHealth = {
  status: 'ok';
  service: 'irec-api';
  version: string;
  timestamp: string;
};

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <main class="shell">
      <section class="hero">
        <div class="mark" aria-hidden="true">iR</div>
        <p class="eyebrow">MVP FOUNDATION · 0.1.0</p>
        <h1>iRec</h1>
        <p class="lead">
          Albumes digitales tematicos para conservar, diseñar y compartir recuerdos.
        </p>

        <div class="status">
          <span class="dot" [class.ok]="apiStatus() === 'online'"></span>
          API: <strong>{{ apiStatus() }}</strong>
        </div>

        <div class="actions">
          <a href="http://localhost:3000/reference" target="_blank" rel="noreferrer">
            Abrir Scalar
          </a>
          <a class="secondary" href="http://localhost:3000/openapi.json" target="_blank" rel="noreferrer">
            OpenAPI JSON
          </a>
        </div>
      </section>

      <section class="grid" aria-label="Roadmap MVP">
        <article>
          <span>0.2.0</span>
          <h2>Identidad</h2>
          <p>Email verificado, TOTP, recuperacion y dispositivo confiable.</p>
        </article>
        <article>
          <span>0.3.0</span>
          <h2>Album Core</h2>
          <p>Albumes publicos/privados, permisos y modo edicion.</p>
        </article>
        <article>
          <span>0.4.0</span>
          <h2>R2 + Fotos</h2>
          <p>BYO Cloudflare R2, subida directa y moderacion.</p>
        </article>
        <article>
          <span>0.5–0.6</span>
          <h2>IA + YouTube</h2>
          <p>ThemeManifest, video y transmisiones integradas.</p>
        </article>
      </section>
    </main>
  `,
})
export class App {
  private readonly http = inject(HttpClient);
  readonly apiStatus = signal<'checking' | 'online' | 'offline'>('checking');

  constructor() {
    this.http.get<ApiHealth>('http://localhost:3000/api/health/live').subscribe({
      next: () => this.apiStatus.set('online'),
      error: () => this.apiStatus.set('offline'),
    });
  }
}
