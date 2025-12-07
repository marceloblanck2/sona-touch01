// SØNA Touch 01 - Loop Management System
// Centralized control for all rhythmic and repeating timers

class LoopManagerClass {
  private loops: Map<number, Set<number>> = new Map();
  private globalTimers: Set<number> = new Set();

  addLoop(voiceId: number, timerId: number): void {
    if (!this.loops.has(voiceId)) {
      this.loops.set(voiceId, new Set());
    }
    this.loops.get(voiceId)!.add(timerId);
  }

  addGlobalTimer(timerId: number): void {
    this.globalTimers.add(timerId);
  }

  clearLoop(voiceId: number): void {
    const timers = this.loops.get(voiceId);
    if (timers) {
      timers.forEach(id => {
        clearTimeout(id);
        clearInterval(id);
      });
      this.loops.delete(voiceId);
    }
  }

  clearAllLoops(): void {
    // Clear all voice-specific loops
    this.loops.forEach((timers) => {
      timers.forEach(id => {
        clearTimeout(id);
        clearInterval(id);
      });
    });
    this.loops.clear();

    // Clear all global timers
    this.globalTimers.forEach(id => {
      clearTimeout(id);
      clearInterval(id);
    });
    this.globalTimers.clear();
  }

  hasLoops(voiceId: number): boolean {
    const timers = this.loops.get(voiceId);
    return timers ? timers.size > 0 : false;
  }

  getLoopCount(): number {
    let count = 0;
    this.loops.forEach(timers => {
      count += timers.size;
    });
    return count + this.globalTimers.size;
  }

  removeTimer(voiceId: number, timerId: number): void {
    const timers = this.loops.get(voiceId);
    if (timers) {
      clearTimeout(timerId);
      clearInterval(timerId);
      timers.delete(timerId);
    }
  }
}

// Global singleton instance
export const LoopManager = new LoopManagerClass();