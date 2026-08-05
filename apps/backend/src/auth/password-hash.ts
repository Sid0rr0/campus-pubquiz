import * as bcrypt from 'bcryptjs';

const PASSWORD_HASH_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
}
