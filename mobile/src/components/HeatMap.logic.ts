export interface HeatMapDay {
  date: string;
  value: number;
}

export interface HeatMapCell extends HeatMapDay {
  isToday: boolean;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfGrid(today: Date): Date {
  const start = new Date(today);
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - 20);
  return start;
}

export function buildHeatMapGrid(days: readonly HeatMapDay[], today: Date): HeatMapCell[] {
  const values = new Map(days.map((day) => [day.date, day.value]));
  const todayKey = dateKey(today);
  const start = startOfGrid(today);
  return Array.from({ length: 21 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dateKey(date);
    return { date: key, value: values.get(key) ?? 0, isToday: key === todayKey };
  });
}
