import { Routes } from '@angular/router';

const suffix = ' · VNHLFL';

export const routes: Routes = [
  {
    path: '',
    title: 'VNHLFL · Ligans historia',
    loadComponent: () => import('./pages/home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'gm',
    title: `GM:s${suffix}`,
    loadComponent: () => import('./pages/managers/managers-page').then((m) => m.ManagersPage),
  },
  {
    path: 'gm/:id',
    title: `GM-profil${suffix}`,
    loadComponent: () => import('./pages/manager/manager-page').then((m) => m.ManagerPage),
  },
  {
    path: 'sasong',
    title: `Säsonger${suffix}`,
    loadComponent: () => import('./pages/season/season-page').then((m) => m.SeasonPage),
  },
  {
    path: 'sasong/:seasonId',
    title: `Säsong${suffix}`,
    loadComponent: () => import('./pages/season/season-page').then((m) => m.SeasonPage),
  },
  {
    path: 'maratontabell',
    title: `Maratontabell${suffix}`,
    loadComponent: () => import('./pages/all-time/all-time-page').then((m) => m.AllTimePage),
  },
  {
    path: 'inbordes',
    title: `Inbördes möten${suffix}`,
    loadComponent: () => import('./pages/h2h/h2h-page').then((m) => m.H2hPage),
  },
  {
    path: 'trades',
    title: `Trades${suffix}`,
    loadComponent: () => import('./pages/trades/trades-page').then((m) => m.TradesPage),
  },
  {
    path: 'draft',
    title: `Draft${suffix}`,
    loadComponent: () => import('./pages/draft/draft-page').then((m) => m.DraftPage),
  },
  {
    path: 'om',
    title: `Om datan${suffix}`,
    loadComponent: () => import('./pages/about/about-page').then((m) => m.AboutPage),
  },
  {
    path: '**',
    title: `Sidan finns inte${suffix}`,
    loadComponent: () => import('./pages/not-found-page').then((m) => m.NotFoundPage),
  },
];
