/**
 * Validação de dígitos verificadores de CNPJ e CPF.
 *
 * O CNPJ já aceita o formato alfanumérico da Receita Federal (12 caracteres
 * [0-9A-Z] + 2 dígitos), em que cada caractere vale `código ASCII - 48`.
 * Para CNPJs só com números o cálculo é idêntico ao tradicional.
 */

const CNPJ_PATTERN = /^[0-9A-Z]{12}\d{2}$/;

function cnpjCheckDigit(base: string): number {
  let weight = base.length - 7;
  let sum = 0;
  for (const ch of base) {
    sum += (ch.charCodeAt(0) - 48) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = value.toUpperCase().replace(/[./-]/g, "");
  if (!CNPJ_PATTERN.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;
  const d1 = cnpjCheckDigit(cnpj.slice(0, 12));
  const d2 = cnpjCheckDigit(cnpj.slice(0, 12) + d1);
  return cnpj.endsWith(`${d1}${d2}`);
}

export function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}
