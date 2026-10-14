import type { RecordDef, RecordValues } from "../core/fields.js";
import { type FormatOptions, formatRecord } from "../core/record.js";
import { R000, R310, R311, R312, R313, R314, R315, R316, R317, R318, R333 } from "./layout.js";
import type { NotfisDocumentInput, NotfisInput, NotfisInvoiceInput } from "./types.js";

export interface GenerateNotfisOptions extends FormatOptions {
  /** @default "\r\n" (padrão mais aceito por sistemas de transportadoras) */
  lineEnding?: "\r\n" | "\n";
  /** Data usada para os valores padrão do cabeçalho. @default new Date() */
  now?: Date;
}

type Values<R extends RecordDef> = Partial<RecordValues<R>>;

/**
 * Gera um arquivo NOTFIS 3.1 a partir de uma estrutura em árvore.
 *
 * - Campos omitidos viram brancos ou zeros, como pede o manual.
 * - O registro 318 é calculado a partir das notas quando `totais` não é informado.
 * - Lança `EdiFormatError` se algum valor não couber no layout.
 */
export function generateNotfis(input: NotfisInput, options: GenerateNotfisOptions = {}): string {
  const now = options.now ?? new Date();
  const lines: string[] = [];
  const emit = <R extends RecordDef>(def: R, values: object) =>
    lines.push(formatRecord(def, clean(values) as Values<R>, options));

  const stamp = ddmmhhmm(now);
  const cab = input.cabecalho ?? {};
  emit(R000, {
    ...cab,
    data: cab.data ?? isoDate(now),
    hora: cab.hora ?? `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    intercambio: cab.intercambio || `NOT${stamp}0`,
  });

  input.documentos.forEach((doc, index) => {
    emit(R310, { documento: doc.documento || `NOTFI${stamp}${index % 10}` });

    for (const { destinatarios, ...shipper } of doc.embarcadoras) {
      emit(R311, shipper);
      for (const { notas, ...recipient } of destinatarios) {
        emit(R312, recipient);
        for (const nota of notas) emitInvoice(nota, emit);
      }
    }

    emit(R318, doc.totais ?? computeTotals(doc));
  });

  const eol = options.lineEnding ?? "\r\n";
  return lines.join(eol) + eol;
}

function emitInvoice(
  nota: NotfisInvoiceInput,
  emit: <R extends RecordDef>(def: R, values: object) => void,
) {
  const { complemento, mercadorias, consignatario, redespacho, responsavelFrete, ...dados } = nota;
  emit(R313, dados);

  if (complemento) {
    const { entregasCasadas = [], ...rest } = complemento;
    if (entregasCasadas.length > 5) {
      throw new RangeError("O registro 333 comporta no máximo 5 entregas casadas.");
    }
    const flat: Record<string, unknown> = { ...rest };
    entregasCasadas.forEach((e, i) => {
      flat[`entrega${i + 1}Cnpj`] = e.cnpj;
      flat[`entrega${i + 1}Serie`] = e.serie;
      flat[`entrega${i + 1}Numero`] = e.numero;
    });
    emit(R333, flat);
  }

  const items = mercadorias ?? [];
  for (let i = 0; i < items.length; i += 4) {
    const flat: Record<string, unknown> = {};
    items.slice(i, i + 4).forEach((item, j) => {
      flat[`volumes${j + 1}`] = item.volumes;
      flat[`especie${j + 1}`] = item.especie;
      flat[`mercadoria${j + 1}`] = item.mercadoria;
    });
    emit(R314, flat);
  }

  if (consignatario) emit(R315, consignatario);
  if (redespacho) emit(R316, redespacho);
  if (responsavelFrete) emit(R317, responsavelFrete);
}

/** Calcula o registro 318 somando as notas do documento (em centavos, sem erro de ponto flutuante). */
export function computeTotals(doc: NotfisDocumentInput): Values<typeof R318> {
  const sum = { valor: 0, peso: 0, cubado: 0, volumes: 0, cobrado: 0, seguro: 0 };
  const c = (n: number | null | undefined) => Math.round((n ?? 0) * 100);
  for (const s of doc.embarcadoras)
    for (const r of s.destinatarios)
      for (const n of r.notas) {
        sum.valor += c(n.valorTotal);
        sum.peso += c(n.peso);
        sum.cubado += c(n.pesoCubado);
        sum.volumes += c(n.volumes);
        sum.cobrado += c(n.valorCobrado);
        sum.seguro += c(n.valorSeguro);
      }
  return {
    valorTotal: sum.valor / 100,
    pesoTotal: sum.peso / 100,
    pesoCubadoTotal: sum.cubado / 100,
    volumesTotal: sum.volumes / 100,
    valorCobradoTotal: sum.cobrado / 100,
    valorSeguroTotal: sum.seguro / 100,
  };
}

/** Remove `null`s para que o formatador aplique o preenchimento padrão. */
function clean(values: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== null && v !== undefined),
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ddmmhhmm = (d: Date) =>
  `${pad(d.getDate())}${pad(d.getMonth() + 1)}${pad(d.getHours())}${pad(d.getMinutes())}`;
