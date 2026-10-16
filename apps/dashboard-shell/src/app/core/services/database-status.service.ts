import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DatabaseService, DatabaseStatusDto } from 'shared-contracts';

@Injectable({
  providedIn: 'root',
})
export class DatabaseStatusService {
  private readonly databaseService = inject(DatabaseService);

  private readonly rawStatus = signal<DatabaseStatusDto | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly status = this.rawStatus.asReadonly();
  readonly isDemo = computed<boolean>(() => this.rawStatus()?.isDemo ?? false);

  constructor() {
    this.loadStatus();
  }

  async loadStatus(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.databaseService.appControllerGetDatabaseStatus()
      );
      this.rawStatus.set(result ?? null);
    } catch (err: unknown) {
      this.rawStatus.set(null);
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  setMockStatus(status: DatabaseStatusDto | null): void {
    this.rawStatus.set(status);
  }
}
