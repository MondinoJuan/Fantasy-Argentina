import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../../servicios/api.service';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-log-in',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LoadingSpinnerComponent],
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

    this.apiService.searchUsers()
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: ({ data }) => {
          const user = data.find((candidate) =>
            candidate.mail.toLowerCase() === credentials.mail.toLowerCase() && candidate.password === credentials.password
          );

          if (!user?.id) {
            this.errorMessage = 'No encontramos un usuario con esos datos.';
            return;
          }

          localStorage.setItem('currentUserId', String(user.id));
          localStorage.setItem('currentUsername', user.username);
          this.router.navigate(['/landingPage']);
        },
        error: () => {
          this.errorMessage = 'No pudimos conectarnos al servidor. Probá nuevamente.';
        }
      });
  }
}
