import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { displayName } from '../data/league-index';
import { Manager } from '../data/models';

/**
 * A GM's name linking to their career page. `asTeam` shows the team name of that season
 * instead, with the GM's current name as a hint when it differs.
 */
@Component({
  selector: 'app-manager-link',
  imports: [RouterLink],
  template: `
    <a [routerLink]="['/gm', manager().id]">{{ label() }}</a>
    @if (hint(); as h) {
      <span class="hint"> ({{ h }})</span>
    }
  `,
  styles: `
    :host {
      display: inline;
    }
    .hint {
      color: var(--muted);
      font-size: var(--text-xs);
    }
  `,
})
export class ManagerLink {
  readonly manager = input.required<Manager>();
  /** The team name used that season, when it should be shown instead of the GM's name. */
  readonly asTeam = input<string>();

  protected readonly label = computed(() => this.asTeam() ?? displayName(this.manager()));
  protected readonly hint = computed(() => {
    const team = this.asTeam();
    const name = displayName(this.manager());
    return team && team.toLowerCase() !== name.toLowerCase() ? name : null;
  });
}
