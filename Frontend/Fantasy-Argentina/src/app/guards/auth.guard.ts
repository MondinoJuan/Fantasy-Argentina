import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../servicios/auth.service';

export const authGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    const invite = route.queryParamMap.get('invite');
    if (invite && /^[A-Za-z0-9-]{3,100}$/.test(invite)) sessionStorage.setItem('pendingTournamentInvite', invite);
    router.navigate(['/logIn']);
    return false;
  }

  return true;
};
