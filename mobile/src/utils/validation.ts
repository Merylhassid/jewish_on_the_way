export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function passwordStrength(pw: string): 'weak' | 'medium' | 'strong' {
  if (pw.length < 6) return 'weak';
  const has = (re: RegExp) => re.test(pw);
  const score = [has(/[A-Z]/), has(/[0-9]/), has(/[^A-Za-z0-9]/), pw.length >= 10].filter(Boolean).length;
  if (score >= 3) return 'strong';
  if (score >= 1) return 'medium';
  return 'weak';
}

export function formatApiError(err: unknown): string {
  const e = err as any;
  const msg = e?.response?.data?.message ?? e?.message ?? 'Something went wrong';
  return Array.isArray(msg) ? msg.join('\n') : String(msg);
}
