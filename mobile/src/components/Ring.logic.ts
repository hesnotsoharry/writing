export interface RingGeometry {
  circumference: number;
  dash: number;
  gap: number;
  progress: number;
}

export function clampProgress(progress: number): number {
  return Math.min(1, Math.max(0, progress));
}

export function getRingGeometry(progress: number, radius: number): RingGeometry {
  const circumference = 2 * Math.PI * radius;
  const clamped = clampProgress(progress);
  return {
    circumference,
    dash: circumference * clamped,
    gap: circumference * (1 - clamped),
    progress: clamped,
  };
}
