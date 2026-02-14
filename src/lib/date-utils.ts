export interface DayGroup<T> {
    label: string;
    date: string;
    items: T[];
}

function toDateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function groupByDay<T>(items: T[], getDate: (item: T) => string): DayGroup<T>[] {
    const groups = new Map<string, T[]>();
    for (const item of items) {
        const key = toDateKey(new Date(getDate(item)));
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
    }

    const now = new Date();
    const today = toDateKey(now);
    const yesterday = toDateKey(new Date(now.getTime() - 86400000));

    return Array.from(groups.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, items]) => ({
            label: key === today
                ? 'Сегодня'
                : key === yesterday
                    ? 'Вчера'
                    : new Date(key + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
            date: key,
            items,
        }));
}

export function filterByDate<T>(items: T[], getDate: (item: T) => string, dateFilter: string): T[] {
    if (!dateFilter) return items;
    return items.filter(item => toDateKey(new Date(getDate(item))) === dateFilter);
}
