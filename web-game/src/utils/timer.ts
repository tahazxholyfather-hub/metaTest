export class Timer {
  private elapsed = 0;
  private fired = false;

  constructor(
    private duration: number,
    private readonly repeat = false,
  ) {}

  update(dtMs: number): boolean {
    if (!this.repeat && this.fired) return false;
    this.elapsed += dtMs;
    if (this.elapsed < this.duration) return false;
    this.elapsed = this.repeat ? this.elapsed % this.duration : this.duration;
    this.fired = true;
    return true;
  }

  reset(duration = this.duration): void {
    this.duration = duration;
    this.elapsed = 0;
    this.fired = false;
  }
}
