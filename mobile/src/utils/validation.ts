export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export const PASSWORD_PATTERN = /^(?=.*\p{L})(?=.*\d).{8,128}$/u;
export const PERSON_NAME_PATTERN = /^[A-Za-z\u05D0-\u05EA]+(?:[ '\-][A-Za-z\u05D0-\u05EA]+)*$/;

export const COMMON_PASSWORDS = [
  '123456',
  '123456789',
  '12345',
  'qwerty',
  'password',
  '12345678',
  '111111',
  '123123',
  '1234567890',
  '1234567',
  'qwerty123',
  '000000',
  '1q2w3e',
  'aa12345678',
  'abc123',
  'password1',
  '1234',
  'qwertyuiop',
  'admin',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'football',
  'iloveyou',
  'sunshine',
  'princess',
  'charlie',
  'donald',
  'qazwsx',
  '123qwe',
  '654321',
  'superman',
  'michael',
  'shadow',
  'master',
  '666666',
  '121212',
  '7777777',
  'passw0rd',
  'baseball',
  'whatever',
  'trustno1',
  'jordan',
  'harley',
  'hunter',
  'buster',
  'soccer',
  'batman',
  'andrew',
  'tigger',
  'zaq1zaq1',
  'q1w2e3r4',
  'asdfgh',
  'zxcvbnm',
  'starwars',
  'hello',
  'freedom',
  'cheese',
  'summer',
  'summer2024',
  'summer2025',
  'winter2024',
  'winter2025',
  'password123',
  'admin123',
  'root',
  'toor',
  'login',
  'test',
  'test123',
  'guest',
  'guest123',
  'user',
  'user123',
  'pass1234',
  'abcd1234',
  'israel123',
  'jerusalem123',
  'shalom123',
  'qwerty12',
] as const;

const COMMON_PASSWORD_SET = new Set<string>(COMMON_PASSWORDS);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORD_SET.has(password.toLowerCase());
}

export function isValidRegistrationPassword(password: string): boolean {
  return PASSWORD_PATTERN.test(password);
}

export function isValidPersonName(name: string): boolean {
  return PERSON_NAME_PATTERN.test(name.trim());
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
