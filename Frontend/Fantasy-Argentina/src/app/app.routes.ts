import { Routes } from '@angular/router';
import { LogInComponent } from './pages/log-in/log-in.component.js';
import { SignUpComponent } from './pages/sign-up/sign-up.component.js';
import { LandingPageComponent } from './pages/landing-page/landing-page.component.js';
import { ModifyUserComponent } from './pages/modify-user/modify-user.component.js';
import { SuperadminMenuComponent } from './pages/superadmin-menu/superadmin-menu.component.js';
import { FixtureComponent } from './pages/fixture/fixture.component.js';
import { InsideTournamentComponent } from './pages/inside-tournament/inside-tournament.component.js';

export const routes: Routes = [
    {path: '', redirectTo: 'logIn', pathMatch: 'full'},
    {path: 'logIn', component: LogInComponent},
    {path: 'signUp', component: SignUpComponent},
    {path: 'landingPage', component: LandingPageComponent},
    {path: 'user-settings', component: ModifyUserComponent},
    {path: 'superadmin-menu', component: SuperadminMenuComponent},
    {path: 'fixture', component: FixtureComponent},
    {path: 'inside-tournament', component: InsideTournamentComponent},
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
