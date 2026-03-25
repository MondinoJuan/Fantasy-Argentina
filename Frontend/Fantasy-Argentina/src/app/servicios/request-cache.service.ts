import { Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

interface CacheEntry<T> {
  createdAt: number;
  ttlMs: number;
  stream$: Observable<T>;
}

@Injectable({ providedIn: 'root' })
export class RequestCacheService {
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  getOrSet<T>(key: string, factory: () => Observable<T>, ttlMs = 30_000): Observable<T> {
    const now = Date.now();
    const existing = this.cache.get(key) as CacheEntry<T> | undefined;

    if (existing && now - existing.createdAt < existing.ttlMs) {
      return existing.stream$;
    }

    const stream$ = factory().pipe(shareReplay({ bufferSize: 1, refCount: true }));
    this.cache.set(key, { createdAt: now, ttlMs, stream$ });
    return stream$;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
