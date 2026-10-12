import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LeagueData } from './data/league-data';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a class="skip" href="#main">Hoppa till innehållet</a>
    <header class="site-header">
      <div class="bar">
        <a class="brand" routerLink="/" aria-label="VNHLFL, till startsidan">
          <span class="mark" aria-hidden="true">V</span>
          <span class="word">VNHLFL<small>Ligans historia</small></span>
        </a>
        <nav aria-label="Huvudmeny">
          <ul>
            @for (item of nav; track item.path) {
              <li>
                <a
                  [routerLink]="item.path"
                  routerLinkActive="active"
                  ariaCurrentWhenActive="page"
                  [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                  >{{ item.label }}</a
                >
              </li>
            }
          </ul>
        </nav>
      </div>
    </header>
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
    <footer class="site-footer">
      <p>
        VNHLFL, Veckans NHL Fantasy League. Statistik från ligans egna sammanställningar.
        <a routerLink="/om">Om datan</a>
      </p>
      @if (version(); as v) {
        <p class="muted">Dataversion {{ v }}</p>
      }
    </footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .skip {
      position: absolute;
      left: var(--space-4);
      top: -3rem;
      background: var(--accent);
      color: var(--accent-ink);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-sm);
      z-index: calc(var(--z-header) + 1);
    }
    .skip:focus {
      top: var(--space-2);
    }
    .site-header {
      background: var(--header-bg);
      color: var(--header-ink);
      position: sticky;
      top: 0;
      z-index: var(--z-header);
    }
    .bar {
      max-width: var(--content-width);
      margin: 0 auto;
      padding: var(--space-2) var(--space-4);
      display: flex;
      align-items: center;
      gap: var(--space-5);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: inherit;
      text-decoration: none;
      flex: none;
    }
    .mark {
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border-radius: var(--radius-sm);
      background: var(--gold-fill);
      color: var(--header-bg);
      font-weight: 900;
      font-size: var(--text-lg);
    }
    .word {
      display: grid;
      font-weight: 900;
      letter-spacing: 0.04em;
      line-height: 1.1;
    }
    .word small {
      font-weight: 600;
      letter-spacing: 0;
      font-size: var(--text-xs);
      color: var(--header-muted);
    }
    nav {
      min-width: 0;
      overflow-x: auto;
      scrollbar-width: none;
    }
    nav ul {
      display: flex;
      gap: var(--space-1);
      list-style: none;
      margin: 0;
      padding: 0;
    }
    nav a {
      display: block;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      color: var(--header-muted);
      font-size: var(--text-sm);
      font-weight: 600;
      white-space: nowrap;
      text-decoration: none;
    }
    nav a:hover {
      color: var(--header-ink);
      background: rgb(255 255 255 / 8%);
    }
    nav a.active {
      color: var(--header-ink);
      background: rgb(255 255 255 / 14%);
    }
    main {
      flex: 1;
      outline: none;
    }
    .site-footer {
      border-top: 1px solid var(--line);
      padding: var(--space-5) var(--space-4);
      text-align: center;
      font-size: var(--text-sm);
      color: var(--ink-2);
      display: grid;
      gap: var(--space-1);
    }
    @media (max-width: 640px) {
      .bar {
        flex-direction: column;
        align-items: stretch;
        gap: var(--space-1);
      }
      .site-header {
        position: static;
      }
    }
  `,
})
export class App {
  private readonly data = inject(LeagueData);

  protected readonly nav = [
    { path: '/', label: 'Start' },
    { path: '/gm', label: 'GM:s' },
    { path: '/sasong', label: 'Säsonger' },
    { path: '/maratontabell', label: 'Maratontabell' },
    { path: '/inbordes', label: 'Inbördes' },
    { path: '/trades', label: 'Trades' },
    { path: '/draft', label: 'Draft' },
    { path: '/om', label: 'Om' },
  ];

  protected readonly version = computed(() =>
    this.data.league.hasValue() ? this.data.league.value().dataVersion : null,
  );
}
