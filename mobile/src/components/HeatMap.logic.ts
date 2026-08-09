export interface HeatMapDay {
  date: string;
  value: number;
}

export interface HeatMapCell extends HeatMapDay {
  isToday: boolean;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfGrid(today: Date): Date {
  const start = new Date(today);
  start.setHours(12, 0, 0, 0);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday - 14);
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
