import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../../servicios/api.service';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../servicios/auth.service';

@Component({
  selector: 'app-log-in',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LoadingSpinnerComponent],
  templateUrl: './log-in.component.html',
  styleUrl: './log-in.component.scss'
})
export class LogInComponent {
  readonly loginForm;

  isLoading = false;
  errorMessage = '';
  successMessage = '';
  private isGoogleInitialized = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    this.loginForm = this.fb.nonNullable.group({
      mail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });

    this.tryVerifyEmailFromQueryToken();
    this.loadGoogleSignInButton();
  }

  private tryVerifyEmailFromQueryToken(): void {
    const verifyToken = this.route.snapshot.queryParamMap.get('verifyToken');
    if (!verifyToken) {
      return;
    }

    this.apiService.verifyEmail({ token: verifyToken }).subscribe({
      next: ({ message }) => {
        this.successMessage = message ?? 'Email verificado con éxito. Ya podés iniciar sesión.';
        this.errorMessage = '';
      },
      error: () => {
        this.errorMessage = 'El link de verificación es inválido o expiró.';
      },
    });
  }

  private loadGoogleSignInButton(): void {
    setTimeout(() => {
      const googleApi = (window as any).google;
      const googleClientId = (window as any).__GOOGLE_CLIENT_ID__ as string | undefined;
      if (!googleApi?.accounts?.id || !googleClientId) {
        return;
      }

      googleApi.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response: { credential?: string }) => this.handleGoogleCredential(response?.credential),
      });
      this.isGoogleInitialized = true;

      googleApi.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'es' }
      );
    }, 0);
  }

  triggerGoogleLogin(): void {
    this.errorMessage = '';
    const googleApi = (window as any).google;
    const googleClientId = (window as any).__GOOGLE_CLIENT_ID__ as string | undefined;

    if (!googleClientId) {
      this.errorMessage = 'Google Login no está configurado todavía (falta GOOGLE_CLIENT_ID en frontend).';
      return;
    }

    if (!googleApi?.accounts?.id) {
      this.errorMessage = 'No se pudo cargar Google Sign-In. Revisá conexión o configuración.';
      return;
    }

    if (!this.isGoogleInitialized) {
      this.loadGoogleSignInButton();
    }

    googleApi.accounts.id.prompt();
  }

  private handleGoogleCredential(idToken?: string): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!idToken) {
      this.errorMessage = 'No se recibió un token válido desde Google.';
      return;
    }

    this.isLoading = true;
    this.apiService.loginWithGoogle({ idToken })
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: ({ data }) => {
          const user = data?.user;
          const token = data?.token;
          if (!user?.id || !token) {
            this.errorMessage = 'No encontramos un usuario con esos datos.';
            return;
          }

          this.authService.setSession(token, user);
          this.router.navigate([user.type === 'SUPERADMIN' ? '/superadmin-menu' : '/landingPage']);
        },
        error: () => {
          this.errorMessage = 'No pudimos iniciar sesión con Google. Probá nuevamente.';
        },
      });
  }

  submit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const credentials = this.loginForm.getRawValue();

    this.apiService.login(credentials)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: ({ data }) => {
          const user = data?.user;
          const token = data?.token;
          if (!user?.id || !token) {
            this.errorMessage = 'No encontramos un usuario con esos datos.';
            return;
          }

          this.authService.setSession(token, user);
          this.router.navigate([user.type === 'SUPERADMIN' ? '/superadmin-menu' : '/landingPage']);
        },
        error: (error) => {
          const status = Number(error?.status ?? 0);
          this.errorMessage = status === 401
            ? 'Credenciales inválidas.'
            : status === 403
              ? 'Debés verificar tu email antes de iniciar sesión.'
              : 'No pudimos conectarnos al servidor. Probá nuevamente.';
        }
      });
  }
}
