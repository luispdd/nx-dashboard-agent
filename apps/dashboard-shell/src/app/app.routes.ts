import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/trends/trends-view.component').then(
        (m) => m.TrendsViewComponent
      ),
  },
  {
    path: 'distribution',
    loadComponent: () =>
      import('./features/distribution/distribution-view.component').then(
        (m) => m.DistributionViewComponent
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings-view.component').then(
        (m) => m.SettingsViewComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
