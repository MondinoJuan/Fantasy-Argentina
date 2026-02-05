import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Tournament {
  name: string;
  location: string;
  startDate: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  activeAuthTab: 'login' | 'register' = 'login';
  isAuthenticated = false;
  currentUser = '';

  loginData = {
    username: '',
    password: ''
  };

  registerData = {
    username: '',
    email: '',
    password: ''
  };

  searchTerm = '';

  newTournament: Tournament = {
    name: '',
    location: '',
    startDate: ''
  };

  tournaments: Tournament[] = [
    {
      name: 'Copa Patagónica',
      location: 'Bariloche',
      startDate: '12/10/2024'
    },
    {
      name: 'Liga Metropolitana',
      location: 'Buenos Aires',
      startDate: '28/10/2024'
    },
    {
      name: 'Torneo Federal',
      location: 'Córdoba',
      startDate: '05/11/2024'
    },
    {
      name: 'Clásico del Norte',
      location: 'Salta',
      startDate: '16/11/2024'
    }
  ];

  get filteredTournaments(): Tournament[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.tournaments;
    }

    return this.tournaments.filter((tournament) =>
      tournament.name.toLowerCase().includes(term)
    );
  }

  switchAuthTab(tab: 'login' | 'register'): void {
    this.activeAuthTab = tab;
  }

  submitLogin(): void {
    if (!this.loginData.username.trim() || !this.loginData.password.trim()) {
      return;
    }

    this.currentUser = this.loginData.username.trim();
    this.isAuthenticated = true;
  }

  submitRegister(): void {
    if (
      !this.registerData.username.trim() ||
      !this.registerData.email.trim() ||
      !this.registerData.password.trim()
    ) {
      return;
    }

    this.currentUser = this.registerData.username.trim();
    this.isAuthenticated = true;
  }

  createTournament(): void {
    if (!this.newTournament.name.trim()) {
      return;
    }

    const createdTournament: Tournament = {
      name: this.newTournament.name.trim(),
      location: this.newTournament.location.trim() || 'A definir',
      startDate: this.newTournament.startDate.trim() || 'Próximamente'
    };

    this.tournaments = [createdTournament, ...this.tournaments];
    this.newTournament = {
      name: '',
      location: '',
      startDate: ''
    };
  }
}
