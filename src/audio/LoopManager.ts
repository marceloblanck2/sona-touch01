// SØNA Pad v2 - Loop Management System
// Centralized control for all rhythmic and repeating timers

class LoopManagerClass {
  private loops: Map<number, number[]> = new Map();

  addLoop(voiceId: number, timerId: number): void {
    const existing = this.loops.get(voiceId) || [];
    existing.push(timerId);
    this.loops.set(voiceId, existing);
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
    this.loops.forEach((timers, voiceId) => {
      timers.forEach(id => {
        clearTimeout(id);
        clearInterval(id);
      });
    });
    this.loops.clear();
  }

  hasLoops(voiceId: number): boolean {
    return this.loops.has(voiceId) && (this.loops.get(voiceId)?.length || 0) > 0;
  }

  getLoopCount(): number {
    let count = 0;
    this.loops.forEach(timers => {
      count += timers.length;
    });
    return count;
  }
}

// Global singleton instance
export const LoopManager = new LoopManagerClass();
