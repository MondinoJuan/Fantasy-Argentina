import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../../servicios/api.service';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modify-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LoadingSpinnerComponent],
  templateUrl: './modify-user.component.html',
  styleUrl: './modify-user.component.scss'
})
export class ModifyUserComponent implements OnInit {
  readonly modifyUserForm;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  private currentUserId = 0;
  private registrationDate = new Date();

  constructor(
    private readonly fb: FormBuilder,
    private readonly apiService: ApiService,
    private readonly router: Router
  ) {
    this.modifyUserForm = this.fb.nonNullable.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      mail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]],
    });
  }

  ngOnInit(): void {
    this.currentUserId = Number(localStorage.getItem('currentUserId'));

    if (!this.currentUserId) {
      this.router.navigate(['/logIn']);
      return;
    }

    this.loadCurrentUser();
  }

  save(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.modifyUserForm.invalid || !this.currentUserId) {
      this.modifyUserForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;

    this.apiService.updateUser({
      id: this.currentUserId,
      ...this.modifyUserForm.getRawValue(),
      registrationDate: this.registrationDate,
    }).pipe(finalize(() => this.isLoading = false)).subscribe({
      next: ({ data }) => {
        localStorage.setItem('currentUsername', data.username);
        this.successMessage = 'Datos guardados con éxito.';
      },
      error: () => {
        this.errorMessage = 'No se pudieron guardar los cambios. Intentá nuevamente.';
      }
    });
  }

  private loadCurrentUser(): void {
    this.isLoading = true;

    this.apiService.searchUserById(this.currentUserId)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: ({ data }) => {
          this.registrationDate = new Date(data.registrationDate);
          this.modifyUserForm.patchValue({
            username: data.username,
            mail: data.mail,
            password: data.password,
          });
        },
        error: () => {
          this.errorMessage = 'No pudimos cargar tus datos de usuario.';
        }
      });
  }

}
