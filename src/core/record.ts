import type { FieldDef, RecordDef, RecordValues } from "./fields.js";
import { EdiFormatError, type Issue } from "./issues.js";

const ONLY_DIGITS = /^\d+$/;

export interface ParseRecordResult<R extends RecordDef> {
  values: RecordValues<R>;
  issues: Issue[];
}

/**
 * Lê uma linha de largura fixa conforme a definição do registro.
 * Nunca lança exceção: problemas viram `issues` e o campo recebe um valor vazio.
 */
export function parseRecord<R extends RecordDef>(
  def: R,
  rawLine: string,
  lineNumber?: number,
): ParseRecordResult<R> {
  const issues: Issue[] = [];
  const at = { line: lineNumber, record: def.id };

  let line = rawLine;
  if (line.length !== def.length) {
    issues.push({
      ...at,
      severity: line.length < def.length ? "warning" : "error",
      code: "LINE_LENGTH",
      message: `Registro ${def.id} deveria ter ${def.length} posições, mas tem ${line.length}.`,
    });
    line = line.padEnd(def.length, " ");
  }

  const values: Record<string, unknown> = {};
  for (const f of def.fields) {
    if (f.kind === "filler") continue;
    const raw = line.slice(f.start - 1, f.start - 1 + f.length);
    values[f.key] = readField(f, raw, (issue) =>
      issues.push({ ...at, field: f.key, position: f.start, ...issue }),
    );
  }

  return { values: values as RecordValues<R>, issues };
}

type Report = (issue: Pick<Issue, "severity" | "code" | "message">) => void;

function readField(f: FieldDef, raw: string, report: Report): unknown {
  if (f.kind === "text") {
    const value = raw.trim();
    if (f.required && value === "") {
      report({
        severity: "error",
        code: "REQUIRED_FIELD",
        message: `Campo ${f.key} é obrigatório.`,
      });
    }
    return value;
  }

  const trimmed = raw.trim();
  // O manual pede zeros em campos numéricos vazios, mas brancos são comuns na prática.
  const blank = trimmed === "";
  if (!blank && !ONLY_DIGITS.test(trimmed)) {
    report({
      severity: "error",
      code: "INVALID_NUMERIC",
      message: `Campo ${f.key} deveria ser numérico, recebeu "${raw}".`,
    });
    return emptyValue(f);
  }
  const zero = blank || /^0+$/.test(trimmed);

  if (f.required && (blank || (zero && f.kind !== "int" && f.kind !== "decimal"))) {
    report({ severity: "error", code: "REQUIRED_FIELD", message: `Campo ${f.key} é obrigatório.` });
  }

  switch (f.kind) {
    case "digits":
      return blank ? "" : raw.trim().padStart(f.length, "0");
    case "int":
      return blank ? null : Number(trimmed);
    case "decimal":
      return blank ? 0 : Number(trimmed) / 10 ** f.decimals;
    case "date":
    case "date6": {
      if (zero) return null;
      const iso = toIsoDate(raw, f.kind === "date6");
      if (!iso) {
        report({
          severity: "error",
          code: "INVALID_DATE",
          message: `Data inválida em ${f.key}: "${raw}".`,
        });
      }
      return iso;
    }
    case "time": {
      if (blank) return null;
      const hh = Number(raw.slice(0, 2));
      const mm = Number(raw.slice(2, 4));
      if (hh > 23 || mm > 59) {
        report({
          severity: "error",
          code: "INVALID_TIME",
          message: `Hora inválida em ${f.key}: "${raw}".`,
        });
        return null;
      }
      return `${raw.slice(0, 2)}:${raw.slice(2, 4)}`;
    }
    default:
      return emptyValue(f);
  }
}

function emptyValue(f: FieldDef): unknown {
  switch (f.kind) {
    case "decimal":
      return 0;
    case "int":
    case "date":
    case "date6":
    case "time":
      return null;
    default:
      return "";
  }
}

function toIsoDate(raw: string, shortYear: boolean): string | null {
  const dd = Number(raw.slice(0, 2));
  const mm = Number(raw.slice(2, 4));
  const yyyy = shortYear ? 2000 + Number(raw.slice(4, 6)) : Number(raw.slice(4, 8));
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (d.getUTCFullYear() !== yyyy || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) {
    return null;
  }
  return `${String(yyyy).padStart(4, "0")}-${raw.slice(2, 4)}-${raw.slice(0, 2)}`;
}

export interface FormatOptions {
  /**
   * Converte texto para maiúsculas e remove acentos, como pede o manual.
   * @default true
   */
  normalizeText?: boolean;
  /**
   * Corta textos maiores que o campo em vez de lançar erro. Números nunca são cortados.
   * @default true
   */
  truncateText?: boolean;
}

/**
 * Gera a linha de largura fixa de um registro. Campos ausentes são preenchidos
 * com brancos (texto) ou zeros (numéricos). Lança `EdiFormatError` quando um
 * valor não cabe no campo.
 */
export function formatRecord<R extends RecordDef>(
  def: R,
  values: Partial<RecordValues<R>>,
  opts: FormatOptions = {},
): string {
  let line = def.id;
  const input = values as Record<string, unknown>;
  for (const f of def.fields) {
    const piece = writeField(def.id, f, input[f.key], opts);
    if (line.length !== f.start - 1) {
      throw new EdiFormatError(
        `Layout inconsistente: ${f.key} deveria começar na posição ${f.start}.`,
        def.id,
        f.key,
      );
    }
    line += piece;
  }
  return line.padEnd(def.length, " ");
}

function writeField(record: string, f: FieldDef, value: unknown, opts: FormatOptions): string {
  const fail = (msg: string): never => {
    throw new EdiFormatError(`Registro ${record}, campo ${f.key}: ${msg}`, record, f.key);
  };
  const isEmpty = value === undefined || value === null || value === "";

  if (f.kind === "filler") return " ".repeat(f.length);

  if (f.kind === "text") {
    let s = isEmpty ? "" : String(value).replace(/[\r\n]+/g, " ");
    if (opts.normalizeText ?? true) {
      s = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
    }
    if (s.length > f.length) {
      if (opts.truncateText ?? true) s = s.slice(0, f.length);
      else fail(`"${s}" excede ${f.length} caracteres.`);
    }
    return s.padEnd(f.length, " ");
  }

  if (isEmpty) return "0".repeat(f.length);

  let out: string;
  switch (f.kind) {
    case "digits":
      out = String(value).replace(/\D/g, "");
      break;
    case "int":
    case "decimal": {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) fail(`valor inválido "${String(value)}".`);
      out = String(Math.round(n * 10 ** f.decimals));
      break;
    }
    case "date":
    case "date6":
      out = formatDate(value, f.kind === "date6") ?? fail(`data inválida "${String(value)}".`);
      break;
    case "time": {
      const m = /^(\d{2}):?(\d{2})$/.exec(String(value));
      out = m ? `${m[1]}${m[2]}` : fail(`hora inválida "${String(value)}".`);
      break;
    }
    default:
      out = fail("tipo de campo desconhecido.");
  }
  if (out.length > f.length) fail(`"${String(value)}" não cabe em ${f.length} posições.`);
  return out.padStart(f.length, "0");
}

function formatDate(value: unknown, shortYear: boolean): string | null {
  let y: number;
  let m: number;
  let d: number;
  if (value instanceof Date) {
    y = value.getFullYear();
    m = value.getMonth() + 1;
    d = value.getDate();
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    if (!match) return null;
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  }
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d)}${p(m)}${shortYear ? p(y % 100) : String(y).padStart(4, "0")}`;
}
