export type IssueSeverity = "error" | "warning";

export type IssueCode =
  | "LINE_LENGTH"
  | "UNKNOWN_RECORD"
  | "INVALID_NUMERIC"
  | "INVALID_DATE"
  | "INVALID_TIME"
  | "REQUIRED_FIELD"
  | "INVALID_CNPJ"
  | "INVALID_CPF"
  | "UNEXPECTED_RECORD"
  | "DUPLICATE_RECORD"
  | "MISSING_RECORD"
  | "TOTALS_MISMATCH";

/** Um problema encontrado ao ler um arquivo EDI. Nunca é lançado: é sempre retornado. */
export interface Issue {
  severity: IssueSeverity;
  code: IssueCode;
  message: string;
  /** Linha do arquivo (1-based), quando aplicável. */
  line?: number;
  /** Identificador do registro (ex.: "313"). */
  record?: string;
  /** Nome do campo no layout. */
  field?: string;
  /** Posição inicial do campo no registro (1-based, como no manual). */
  position?: number;
}

/** Erro lançado na geração de arquivos quando os dados não cabem no layout. */
export class EdiFormatError extends Error {
  constructor(
    message: string,
    readonly record: string,
    readonly field: string,
  ) {
    super(message);
    this.name = "EdiFormatError";
  }
}
