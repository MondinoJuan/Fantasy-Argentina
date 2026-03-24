import { Routes } from '@angular/router';
import { LogInComponent } from './pages/log-in/log-in.component.js';
import { SignUpComponent } from './pages/sign-up/sign-up.component.js';
import { LandingPageComponent } from './pages/landing-page/landing-page.component.js';
import { ModifyUserComponent } from './pages/modify-user/modify-user.component.js';
import { SuperadminMenuComponent } from './pages/superadmin-menu/superadmin-menu.component.js';
import { FixtureComponent } from './pages/fixture/fixture.component.js';
import { InsideTournamentComponent } from './pages/inside-tournament/inside-tournament.component.js';
import { authGuard } from './guards/auth.guard';
import { superadminGuard } from './guards/superadmin.guard';

export const routes: Routes = [
    {path: '', redirectTo: 'logIn', pathMatch: 'full'},
    {path: 'logIn', component: LogInComponent},
    {path: 'signUp', component: SignUpComponent},
    {path: 'landingPage', component: LandingPageComponent, canActivate: [authGuard]},
    {path: 'user-settings', component: ModifyUserComponent, canActivate: [authGuard]},
    {path: 'superadmin-menu', component: SuperadminMenuComponent, canActivate: [superadminGuard]},
    {path: 'fixture', component: FixtureComponent, canActivate: [authGuard]},
    {path: 'inside-tournament', component: InsideTournamentComponent, canActivate: [authGuard]},
];

export const routingComponents = [
    LogInComponent,
    SignUpComponent,
    LandingPageComponent,
    ModifyUserComponent,
    SuperadminMenuComponent,
    FixtureComponent,
    InsideTournamentComponent,
];
