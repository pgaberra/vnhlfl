import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template: `
    <div class="page">
      <header class="page-head">
        <p class="eyebrow">404</p>
        <h1>Sidan finns inte</h1>
        <p class="lede">Länken kan vara gammal. <a routerLink="/">Till startsidan</a>.</p>
      </header>
    </div>
  `,
})
export class NotFoundPage {}
