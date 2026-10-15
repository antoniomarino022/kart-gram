/** Critically damped follower (Unity-style SmoothDamp). Allocation-free. */
export class DampedValue {
  value: number;
  private velocity = 0;

  constructor(initial: number) {
    this.value = initial;
  }

  snap(value: number): void {
    this.value = value;
    this.velocity = 0;
  }

  update(target: number, smoothTime: number, dt: number): number {
    const omega = 2 / Math.max(smoothTime, 0.0001);
    const x = omega * dt;
    const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = this.value - target;
    const temp = (this.velocity + omega * change) * dt;
    this.velocity = (this.velocity - omega * temp) * decay;
    this.value = target + (change + temp) * decay;
    return this.value;
  }
}
