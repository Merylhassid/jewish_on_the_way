import { validateSync } from 'class-validator';
import { RegisterDto } from './register.dto';

function makeDto(overrides: Partial<RegisterDto> = {}) {
  return Object.assign(new RegisterDto(), {
    email: 'user@example.com',
    password: 'Fresh123!',
    firstName: 'דני',
    lastName: "Ben-David",
    ...overrides,
  });
}

describe('RegisterDto', () => {
  it('accepts Hebrew or English names and passwords with symbols', () => {
    const errors = validateSync(makeDto({ firstName: 'דני', lastName: "כהן לוי", password: 'שלום123!' }));

    expect(errors).toHaveLength(0);
  });

  it('rejects passwords without a digit', () => {
    const errors = validateSync(makeDto({ password: 'FreshPassword!' }));

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('rejects passwords without a letter', () => {
    const errors = validateSync(makeDto({ password: '12345678!' }));

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('rejects names with unsupported characters', () => {
    const errors = validateSync(makeDto({ firstName: 'Dani2', lastName: 'Cohen@' }));

    expect(errors.some((error) => error.property === 'firstName')).toBe(true);
    expect(errors.some((error) => error.property === 'lastName')).toBe(true);
  });
});
