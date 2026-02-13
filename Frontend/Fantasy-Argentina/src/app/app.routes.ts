import { Routes } from '@angular/router';
import { LogInComponent } from './pages/log-in/log-in.component.js';
import { SignUpComponent } from './pages/sign-up/sign-up.component.js';
import { LandingPageComponent } from './pages/landing-page/landing-page.component.js';

export const routes: Routes = [
    {path: '', redirectTo: 'logIn', pathMatch: 'full'},
    {path: 'logIn', component: LogInComponent},
    {path: 'signUp', component: SignUpComponent},
    {path: 'landingPage', component: LandingPageComponent},
];

export const routingComponents = [
    LogInComponent,
    SignUpComponent,
    LandingPageComponent,
];
