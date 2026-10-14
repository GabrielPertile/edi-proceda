import type { RecordDef, RecordValues } from "../core/fields.js";
import type { Issue } from "../core/issues.js";
import { parseRecord } from "../core/record.js";
import { isValidCnpj, isValidCpf } from "../validators/documents.js";
import { R000, R310, R311, R312, R313, R314, R315, R316, R317, R318, R333 } from "./layout.js";
import type {
  NotfisComplement,
  NotfisDocument,
  NotfisFile,
  NotfisInvoice,
  NotfisItem,
  NotfisRecipient,
  NotfisShipper,
} from "./types.js";

export interface ParseNotfisOptions {
  /** Confere os dígitos verificadores de CNPJ/CPF. @default true */
  validateDocuments?: boolean;
  /** Confere o registro 318 contra a soma das notas (313). @default true */
  validateTotals?: boolean;
}

export interface ParseNotfisResult {
  /** `true` quando não há nenhum issue de severidade `error`. */
  ok: boolean;
  /** Estrutura lida. Mesmo com erros, contém tudo que foi possível interpretar. */
  data: NotfisFile;
  issues: Issue[];
}

const RECORDS: Record<string, RecordDef> = {
  "000": R000,
  "310": R310,
  "311": R311,
  "312": R312,
  "313": R313,
  "333": R333,
  "314": R314,
  "315": R315,
  "316": R316,
  "317": R317,
  "318": R318,
};

/**
 * Lê um arquivo NOTFIS 3.1 e devolve a árvore cabeçalho → documentos → embarcadoras
 * → destinatários → notas, com todos os problemas encontrados. Não lança exceções.
 */
export function parseNotfis(content: string, options: ParseNotfisOptions = {}): ParseNotfisResult {
  const issues: Issue[] = [];
  const data: NotfisFile = { cabecalho: null, documentos: [] };

  let doc: NotfisDocument | undefined;
  let shipper: NotfisShipper | undefined;
  let recipient: NotfisRecipient | undefined;
  let invoice: NotfisInvoice | undefined;

  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content; // remove BOM
  const lines = text.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const lineNo = index + 1;
    if (line.trim() === "") continue;

    const id = line.slice(0, 3);
    const def = RECORDS[id];
    if (!def) {
      issues.push({
        severity: "error",
        code: "UNKNOWN_RECORD",
        line: lineNo,
        record: id,
        message: `Identificador de registro desconhecido: "${id}".`,
      });
      continue;
    }

    const parsed = parseRecord(def, line, lineNo);
    issues.push(...parsed.issues);
    const v = parsed.values as Record<string, unknown>;

    const unexpected = (parent: string): void => {
      issues.push({
        severity: "error",
        code: "UNEXPECTED_RECORD",
        line: lineNo,
        record: id,
        message: `Registro ${id} encontrado sem um registro ${parent} antes dele.`,
      });
    };
    const duplicate = (parent: string): void => {
      issues.push({
        severity: "warning",
        code: "DUPLICATE_RECORD",
        line: lineNo,
        record: id,
        message: `O manual permite apenas um registro ${id} por ${parent}; o anterior foi substituído.`,
      });
    };

    switch (id) {
      case "000":
        if (data.cabecalho) duplicate("arquivo");
        data.cabecalho = v as NotfisFile["cabecalho"];
        continue;

      case "310":
        if (!data.cabecalho) unexpected("000");
        doc = { documento: v.documento as string, embarcadoras: [], totais: null };
        data.documentos.push(doc);
        shipper = recipient = invoice = undefined;
        continue;

      case "311":
        if (!doc) {
          unexpected("310");
          continue;
        }
        shipper = { ...(v as RecordValues<typeof R311>), destinatarios: [] };
        doc.embarcadoras.push(shipper);
        recipient = invoice = undefined;
        if (options.validateDocuments ?? true) checkCnpj(v.cnpj as string, lineNo, id, issues);
        continue;

      case "312":
        if (!shipper) {
          unexpected("311");
          continue;
        }
        recipient = { ...(v as RecordValues<typeof R312>), notas: [] };
        shipper.destinatarios.push(recipient);
        invoice = undefined;
        if (options.validateDocuments ?? true) checkCnpjCpf(recipient, lineNo, issues);
        continue;

      case "313":
        if (!recipient) {
          unexpected("312");
          continue;
        }
        invoice = {
          ...(v as RecordValues<typeof R313>),
          complemento: null,
          mercadorias: [],
          consignatario: null,
          redespacho: null,
          responsavelFrete: null,
        };
        recipient.notas.push(invoice);
        continue;

      case "333":
        if (!invoice) {
          unexpected("313");
          continue;
        }
        if (invoice.complemento) duplicate("nota fiscal");
        invoice.complemento = toComplement(v);
        continue;

      case "314":
        if (!invoice) {
          unexpected("313");
          continue;
        }
        invoice.mercadorias.push(...toItems(v));
        continue;

      case "315":
      case "316":
      case "317": {
        if (!invoice) {
          unexpected("313");
          continue;
        }
        const key = (
          { "315": "consignatario", "316": "redespacho", "317": "responsavelFrete" } as const
        )[id];
        if (invoice[key]) duplicate("nota fiscal");
        (invoice as Record<string, unknown>)[key] = v;
        if (options.validateDocuments ?? true) checkCnpj(v.cnpj as string, lineNo, id, issues);
        continue;
      }

      case "318":
        if (!doc) {
          unexpected("310");
          continue;
        }
        if (doc.totais) duplicate("documento (310)");
        doc.totais = v as NotfisDocument["totais"];
        if (options.validateTotals ?? true) checkTotals(doc, lineNo, issues);
        continue;
    }
  }

  if (!data.cabecalho) {
    issues.push({
      severity: "error",
      code: "MISSING_RECORD",
      record: "000",
      message: "Arquivo sem cabeçalho (000).",
    });
  }
  for (const d of data.documentos) {
    if (!d.totais) {
      issues.push({
        severity: "error",
        code: "MISSING_RECORD",
        record: "318",
        message: `Documento "${d.documento}" sem registro de totais (318).`,
      });
    }
  }

  return { ok: !issues.some((i) => i.severity === "error"), data, issues };
}

function toComplement(v: Record<string, unknown>): NotfisComplement {
  const rest: Record<string, unknown> = {};
  const entregasCasadas: NotfisComplement["entregasCasadas"] = [];
  for (const [k, value] of Object.entries(v)) {
    if (!k.startsWith("entrega")) rest[k] = value;
  }
  for (let i = 1; i <= 5; i++) {
    const cnpj = v[`entrega${i}Cnpj`] as string;
    const numero = v[`entrega${i}Numero`] as string;
    if (/[1-9]/.test(cnpj) || /[1-9]/.test(numero)) {
      entregasCasadas.push({ cnpj, serie: v[`entrega${i}Serie`] as string, numero });
    }
  }
  return { ...(rest as Omit<NotfisComplement, "entregasCasadas">), entregasCasadas };
}

function toItems(v: Record<string, unknown>): NotfisItem[] {
  const items: NotfisItem[] = [];
  for (let i = 1; i <= 4; i++) {
    const item = {
      volumes: v[`volumes${i}`] as number,
      especie: v[`especie${i}`] as string,
      mercadoria: v[`mercadoria${i}`] as string,
    };
    if (i === 1 || item.volumes > 0 || item.especie || item.mercadoria) items.push(item);
  }
  return items;
}

function checkCnpj(value: string, line: number, record: string, issues: Issue[]) {
  if (value && !isValidCnpj(value)) {
    issues.push({
      severity: "warning",
      code: "INVALID_CNPJ",
      line,
      record,
      field: "cnpj",
      message: `CNPJ com dígito verificador inválido: ${value}.`,
    });
  }
}

function checkCnpjCpf(r: NotfisRecipient, line: number, issues: Issue[]) {
  const value = r.cnpjCpf;
  if (!value) return;
  const asCpf = value.slice(-11);
  const valid =
    r.tipoIdentificacao === "2"
      ? isValidCpf(asCpf)
      : r.tipoIdentificacao === "1"
        ? isValidCnpj(value)
        : isValidCnpj(value) || (value.startsWith("000") && isValidCpf(asCpf));
  if (!valid) {
    const isCpf = r.tipoIdentificacao === "2";
    issues.push({
      severity: "warning",
      code: isCpf ? "INVALID_CPF" : "INVALID_CNPJ",
      line,
      record: "312",
      field: "cnpjCpf",
      message: `${isCpf ? "CPF" : "CNPJ/CPF"} do destinatário com dígito verificador inválido: ${value}.`,
    });
  }
}

const cents = (n: number) => Math.round(n * 100);

function checkTotals(doc: NotfisDocument, line: number, issues: Issue[]) {
  const t = doc.totais;
  if (!t) return;
  const sum = { valor: 0, peso: 0, volumes: 0 };
  for (const s of doc.embarcadoras)
    for (const r of s.destinatarios)
      for (const n of r.notas) {
        sum.valor += cents(n.valorTotal);
        sum.peso += cents(n.peso);
        sum.volumes += cents(n.volumes);
      }

  const checks = [
    ["valorTotal", t.valorTotal, sum.valor, "valor total das notas"],
    ["pesoTotal", t.pesoTotal, sum.peso, "peso total"],
    ["volumesTotal", t.volumesTotal, sum.volumes, "quantidade de volumes"],
  ] as const;

  for (const [field, declared, computed, label] of checks) {
    if (cents(declared) !== computed) {
      issues.push({
        severity: "warning",
        code: "TOTALS_MISMATCH",
        line,
        record: "318",
        field,
        message: `Divergência no ${label}: 318 informa ${declared.toFixed(2)}, soma das notas é ${(computed / 100).toFixed(2)}.`,
      });
    }
  }
}
