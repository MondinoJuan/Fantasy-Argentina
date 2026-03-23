import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../servicios/auth.service';

export const superadminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/logIn']);
    return false;
  }

  if (!authService.hasRole('SUPERADMIN')) {
    router.navigate(['/landingPage']);
    return false;
  }

  return true;
};
