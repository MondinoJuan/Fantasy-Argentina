import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../../servicios/api.service';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LoadingSpinnerComponent],
  templateUrl: './sign-up.component.html',
  styleUrl: './sign-up.component.scss'
})
export class SignUpComponent {
  readonly signUpForm;

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly router: Router
  ) {
    this.signUpForm = this.fb.nonNullable.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      mail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]],
      superadminCode: ['']
    });
  }

  submit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.signUpForm.invalid) {
      this.signUpForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formValue = this.signUpForm.getRawValue();
    const payload = {
      username: formValue.username,
      mail: formValue.mail,
      password: formValue.password,
      registrationDate: new Date(),
      type: 'USER' as const,
      superadminCode: formValue.superadminCode,
    };

    this.apiService.postUser(payload)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          const serverMessage = String(response?.message ?? '');
          this.successMessage = serverMessage.includes('pending')
            ? 'Cuenta creada, pero hubo un problema al enviar el mail de verificación. Contactá soporte para reenviarlo.'
            : 'Cuenta creada. Revisá tu email para verificarla antes de iniciar sesión.';
          this.signUpForm.reset();
          setTimeout(() => this.router.navigate(['/logIn']), 1600);
        },
        error: (error) => {
          const status = Number(error?.status ?? 0);
          const backendMessage = String(error?.error?.message ?? '');
          this.errorMessage = status === 409
            ? 'Ese email ya está registrado.'
            : backendMessage || 'No se pudo crear la cuenta. Verificá los datos e intentá otra vez.';
        }
      });
  }
}
