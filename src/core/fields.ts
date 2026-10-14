/**
 * Definição declarativa de campos de largura fixa.
 *
 * Os layouts PROCEDA descrevem cada campo como `A n` (alfanumérico) ou `N n` / `N i,d`
 * (numérico, com decimais implícitos). Aqui cada campo também ganha uma semântica
 * (data, hora, documento...) para que o parser devolva valores prontos para uso.
 */

export type FieldKind =
  /** `A n`: texto alinhado à esquerda, completado com espaços. */
  | "text"
  /** `N n` que deve ser preservado como string (CNPJ, número de NF, CFOP). */
  | "digits"
  /** `N n` tratado como número inteiro (códigos de domínio). */
  | "int"
  /** `N i,d`: número com `d` casas decimais implícitas. */
  | "decimal"
  /** `N 8` no formato DDMMAAAA. */
  | "date"
  /** `N 6` no formato DDMMAA. */
  | "date6"
  /** `N 4` no formato HHMM. */
  | "time"
  /** Área reservada, preenchida com brancos. */
  | "filler";

export interface FieldDef<K extends string = string, T extends FieldKind = FieldKind> {
  readonly key: K;
  readonly kind: T;
  /** Posição inicial, 1-based, exatamente como no manual. */
  readonly start: number;
  /** Tamanho total em caracteres (para decimais, inteiros + casas decimais). */
  readonly length: number;
  readonly decimals: number;
  /** `M` no manual. */
  readonly required: boolean;
}

interface FieldOptions {
  required?: boolean;
}

function field<K extends string, T extends FieldKind>(
  key: K,
  kind: T,
  start: number,
  length: number,
  opts: FieldOptions = {},
  decimals = 0,
): FieldDef<K, T> {
  return { key, kind, start, length, decimals, required: opts.required ?? false };
}

export const text = <K extends string>(
  key: K,
  start: number,
  length: number,
  opts?: FieldOptions,
) => field(key, "text", start, length, opts);

export const digits = <K extends string>(
  key: K,
  start: number,
  length: number,
  opts?: FieldOptions,
) => field(key, "digits", start, length, opts);

export const int = <K extends string>(key: K, start: number, length: number, opts?: FieldOptions) =>
  field(key, "int", start, length, opts);

/** `N i,d` do manual: `decimal("valor", 86, 13, 2)` ocupa 15 posições. */
export const decimal = <K extends string>(
  key: K,
  start: number,
  integers: number,
  decimals: number,
  opts?: FieldOptions,
) => field(key, "decimal", start, integers + decimals, opts, decimals);

export const date = <K extends string>(key: K, start: number, opts?: FieldOptions) =>
  field(key, "date", start, 8, opts);

export const date6 = <K extends string>(key: K, start: number, opts?: FieldOptions) =>
  field(key, "date6", start, 6, opts);

export const time = <K extends string>(key: K, start: number, opts?: FieldOptions) =>
  field(key, "time", start, 4, opts);

export const filler = (start: number, length: number) =>
  field("filler" as const, "filler", start, length);

/** Tipo TypeScript produzido por cada tipo de campo ao fazer o parse. */
export interface KindValue {
  text: string;
  digits: string;
  int: number | null;
  decimal: number;
  /** ISO `YYYY-MM-DD`, ou `null` quando o campo vem zerado/em branco. */
  date: string | null;
  date6: string | null;
  /** `HH:MM`, ou `null` quando vazio. */
  time: string | null;
  filler: never;
}

export interface RecordDef<
  Id extends string = string,
  F extends readonly FieldDef[] = readonly FieldDef[],
> {
  readonly id: Id;
  readonly name: string;
  readonly length: number;
  readonly fields: F;
}

/** Objeto com os valores de um registro, inferido a partir da definição do layout. */
export type RecordValues<R extends RecordDef> = {
  [F in R["fields"][number] as F["kind"] extends "filler" ? never : F["key"]]: KindValue[F["kind"]];
};

/**
 * Define um registro. O identificador (posições 1 a 3) é tratado automaticamente,
 * então `fields` começa na posição 4.
 */
export function defineRecord<const Id extends string, const F extends readonly FieldDef[]>(def: {
  id: Id;
  name: string;
  length: number;
  fields: F;
}): RecordDef<Id, F> {
  return def;
}
