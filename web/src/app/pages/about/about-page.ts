import { Component, computed, inject } from '@angular/core';
import { LeagueData } from '../../data/league-data';
import { LoadState } from '../../shared/load-state';

@Component({
  selector: 'app-about-page',
  imports: [LoadState],
  template: `
    <div class="page">
      <header class="page-head">
        <p class="eyebrow">Om sidan</p>
        <h1>Om datan</h1>
        <p class="lede">
          All statistik kommer från ligans egna sammanställningar sedan första säsongen. Här är vad
          som finns med och vad som fortfarande saknas.
        </p>
      </header>

      @if (rows(); as list) {
        <section class="card" aria-labelledby="coverage">
          <h2 id="coverage">Vad som finns per säsong</h2>
          <div class="table-scroll">
            <table class="data">
              <thead>
                <tr>
                  <th scope="col">Säsong</th>
                  <th scope="col">Sluttabell</th>
                  <th scope="col">Veckotabeller</th>
                  <th scope="col">Draft</th>
                  <th scope="col">Trades</th>
                  <th scope="col">Matcher</th>
                </tr>
              </thead>
              <tbody>
                @for (row of list; track row.label) {
                  <tr>
                    <th scope="row">{{ row.label }}</th>
                    @for (cell of row.cells; track $index) {
                      <td [class.muted]="!cell">{{ cell ? 'Ja' : 'Saknas' }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @else {
        <app-load-state [refs]="[data.league]" />
      }

      <section class="card prose">
        <h2>Namn</h2>
        <p>
          Sidan visar bara lagnamn. En GM syns under sitt senaste lagnamn, och profilen listar de
          namn hen spelat under tidigare. Riktiga namn publiceras inte.
        </p>
        <h2>Hur siffrorna räknas</h2>
        <p>
          Vinster, förluster och poäng kommer från grundserien. Slutplaceringen är Yahoos
          sluttabell, där slutspelet räknas in, och en titel är en förstaplats i den. Vinst% räknar
          oavgjort som en halv vinst. Byter en GM lag mitt i säsongen följer resultatet laget i
          sluttabellen.
        </p>
        <h2>Det som saknas</h2>
        <p>
          Matcher och trades från 2024/25 och 2025/26 finns bara som skärmdumpar och är inte inlästa
          än, och inte heller veckotabellerna efter 2023/24. Lag som dykt upp sedan 2025/26 är ännu
          inte kopplade till sina GM:s, så en GM som bytt lagnamn kan synas som två. Allt går att
          hämta från Yahoo och läggs till efter hand.
        </p>
        <h2>Hittat ett fel?</h2>
        <p>Hör av dig till ligans grundare, så rättar vi källdatan.</p>
      </section>
    </div>
  `,
  styles: `
    .prose {
      max-width: 48rem;
    }
    .prose h2 {
      margin-top: var(--space-2);
    }
  `,
})
export class AboutPage {
  protected readonly data = inject(LeagueData);

  protected readonly rows = computed(() => {
    const idx = this.data.index();
    if (!idx) return null;
    const c = idx.league.coverage;
    return idx.seasons.map((s) => ({
      label: s.label,
      cells: [c.finalStandings, c.weeklyStandings, c.draft, c.trades, c.matchups].map((list) =>
        list.includes(s.id),
      ),
    }));
  });
}
