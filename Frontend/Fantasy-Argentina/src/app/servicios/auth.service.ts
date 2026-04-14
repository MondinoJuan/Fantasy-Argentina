import { Injectable } from '@angular/core';

export interface SessionUser {
  id: number;
  username: string;
  mail: string;
  type: 'USER' | 'SUPERADMIN';
}

const TOKEN_KEY = 'authToken';
const LEGACY_TOKEN_KEY = 'token';
const USER_KEY = 'currentUser';

@Injectable({ providedIn: 'root' })
export class AuthService {
  setSession(token: string, user: SessionUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem('currentUserId', String(user.id));
    localStorage.setItem('currentUsername', user.username);
    localStorage.setItem('currentUserType', user.type ?? 'USER');
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY);
  }

  getCurrentUser(): SessionUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  hasRole(role: SessionUser['type']): boolean {
    return this.getCurrentUser()?.type === role;
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('currentUsername');
    localStorage.removeItem('currentUserType');
  }
}
