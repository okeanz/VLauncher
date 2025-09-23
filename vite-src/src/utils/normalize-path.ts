export function normalizePath(p: string): string {
  return (
    p
      // заменяем обратные слэши на прямые
      .replace(/\\/g, '/')
      // убираем повторяющиеся слэши
      .replace(/\/+/g, '/')
      // если есть `C:/` или подобное — оставляем с двоеточием
      .replace(/^([A-Za-z]):\//, '$1:/')
  );
}
