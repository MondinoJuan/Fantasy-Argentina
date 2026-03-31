export function serverNow(): Date {
  return new Date();
}

export function serverNowMs(): number {
  return serverNow().getTime();
}
