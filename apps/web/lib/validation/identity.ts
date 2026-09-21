/**
 * Client-side mirror of the constraints in openapi.yaml
 * (RegisterApplicantRequest / LoginRequest) and docs/slices/s1-identity.md.
 * The server remains authoritative; this only gives immediate form feedback.
 *
 * The functions return the sentences the form shows. Field errors that come
 * back from the API are sentences the server wrote and are displayed as they
 * are, in the same place.
 */
export type FieldErrors = Record<string, string[]>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IIN_PATTERN = /^[0-9]{12}$/;

export function minEligibleBirthYear(): number {
  return new Date().getFullYear() - 18;
}

export function validateEmail(email: string): string[] {
  const errors: string[] = [];
  if (!email.trim()) errors.push('Enter your email address.');
  else if (email.length > 254) errors.push('The email cannot be longer than 254 characters.');
  else if (!EMAIL_PATTERN.test(email.trim())) errors.push('Enter a valid email address.');
  return errors;
}

export function validatePassword(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 15) errors.push('The password must be at least 15 characters.');
  else if (password.length > 128) errors.push('The password cannot be longer than 128 characters.');
  return errors;
}

export function validateRegisterFields(input: {
  email: string;
  iin: string;
  fullName: string;
  birthYear: number | null;
  password: string;
}): FieldErrors {
  const errors: FieldErrors = {};

  const emailErrors = validateEmail(input.email);
  if (emailErrors.length) errors.email = emailErrors;

  if (!IIN_PATTERN.test(input.iin.trim())) {
    errors.iin = ['The IIN is exactly 12 digits.'];
  }

  const fullName = input.fullName.trim();
  if (fullName.length < 2 || fullName.length > 120) {
    errors.fullName = ['The name must be between 2 and 120 characters.'];
  }

  const maxYear = minEligibleBirthYear();
  if (input.birthYear === null || Number.isNaN(input.birthYear)) {
    errors.birthYear = ['Enter your year of birth.'];
  } else if (input.birthYear < 1900 || input.birthYear > maxYear) {
    errors.birthYear = [`Year of birth must be between 1900 and ${minEligibleBirthYear()}.`];
  }

  const passwordErrors = validatePassword(input.password);
  if (passwordErrors.length) errors.password = passwordErrors;

  return errors;
}

export function validateLoginFields(input: { email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  const emailErrors = validateEmail(input.email);
  if (emailErrors.length) errors.email = emailErrors;
  if (!input.password) errors.password = ['Enter your password.'];
  return errors;
}
