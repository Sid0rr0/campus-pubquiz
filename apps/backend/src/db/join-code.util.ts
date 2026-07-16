import { randomInt } from 'node:crypto';

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 6;

export function generateJoinCode(length: number = JOIN_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}
