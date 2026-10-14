// Núcleo genérico: permite descrever qualquer layout de largura fixa.
export {
  date,
  date6,
  decimal,
  defineRecord,
  digits,
  type FieldDef,
  type FieldKind,
  filler,
  int,
  type RecordDef,
  type RecordValues,
  text,
  time,
} from "./core/fields.js";
export { EdiFormatError, type Issue, type IssueCode, type IssueSeverity } from "./core/issues.js";
export { type FormatOptions, formatRecord, parseRecord } from "./core/record.js";

// NOTFIS 3.1
export { computeTotals, type GenerateNotfisOptions, generateNotfis } from "./notfis/generate.js";
export { NOTFIS_31 } from "./notfis/layout.js";
export { type ParseNotfisOptions, type ParseNotfisResult, parseNotfis } from "./notfis/parse.js";
export type * from "./notfis/types.js";

// Validadores
export { isValidCnpj, isValidCpf } from "./validators/documents.js";
