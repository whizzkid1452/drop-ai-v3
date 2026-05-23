import type { SessionStore } from '@/layers/core/session/session-store';

export interface AutosaveControllerDependencies {
  sessionStore: SessionStore;
  saveSession: () => Promise<void>;
  debounceMs: number;
}

export class AutosaveController {
  private readonly sessionStore: SessionStore;
  private readonly saveSession: () => Promise<void>;
  private readonly debounceMs: number;
  private readonly unsubscribe: () => void;
  private timerHandle: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(deps: AutosaveControllerDependencies) {
    this.sessionStore = deps.sessionStore;
    this.saveSession = deps.saveSession;
    this.debounceMs = deps.debounceMs;
    this.unsubscribe = this.sessionStore.subscribe(state => {
      if (this.disposed) return;
      if (state.dirty) {
        this.scheduleSave();
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    if (this.timerHandle !== null) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
    this.unsubscribe();
  }

  private scheduleSave(): void {
    if (this.timerHandle !== null) {
      clearTimeout(this.timerHandle);
    }
    this.timerHandle = setTimeout(() => {
      this.timerHandle = null;
      if (this.disposed) return;
      if (!this.sessionStore.getState().dirty) return;
      void this.saveSession();
    }, this.debounceMs);
  }
}
