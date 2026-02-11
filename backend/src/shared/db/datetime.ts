const pad = (value: number): string => value.toString().padStart(2, '0');

export function toMysqlDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid datetime value');
  }

  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function toNullableMysqlDateTime(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return toMysqlDateTime(value);
}

export function toMysqlDate(value: string | Date): string {
  return toMysqlDateTime(value).slice(0, 10);
}
