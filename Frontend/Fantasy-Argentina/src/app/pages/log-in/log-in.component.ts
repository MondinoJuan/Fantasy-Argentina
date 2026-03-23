import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.loginForm = this.fb.nonNullable.group({
      mail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  submit(): void {
    this.errorMessage = '';

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
            : 'No pudimos conectarnos al servidor. Probá nuevamente.';
        }
      });
  }
}
