import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  const cloned = token ? req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  }) : req;

  return next(cloned).pipe(
    catchError((error) => {
      const isUnauthorized = Number(error?.status ?? 0) === 401;
      const isLoginRequest = cloned.url.includes('/auth/login');

      if (isUnauthorized && !isLoginRequest) {
        authService.clearSession();
        router.navigate(['/logIn']);
      }

      return throwError(() => error);
    }),
  );
};
