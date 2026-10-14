import type { RecordValues } from "../core/fields.js";
import type { R000, R311, R312, R313, R315, R316, R317, R318, R333 } from "./layout.js";

export type NotfisHeader = RecordValues<typeof R000>;
export type NotfisTotals = RecordValues<typeof R318>;
export type NotfisParty = RecordValues<typeof R315>;
export type NotfisRedispatch = RecordValues<typeof R316>;
export type NotfisFreightPayer = RecordValues<typeof R317>;

type Raw333 = RecordValues<typeof R333>;
type JointKeys = Extract<keyof Raw333, `entrega${number}${string}`>;

/** Nota de outro emissor que deve ser entregue junto (registro 333). */
export interface NotfisJointDelivery {
  cnpj: string;
  serie: string;
  numero: string;
}

export type NotfisComplement = Omit<Raw333, JointKeys> & {
  entregasCasadas: NotfisJointDelivery[];
};

/** Mercadoria do registro 314 (cada linha comporta até 4). */
export interface NotfisItem {
  volumes: number;
  especie: string;
  mercadoria: string;
}

export type NotfisInvoice = RecordValues<typeof R313> & {
  complemento: NotfisComplement | null;
  mercadorias: NotfisItem[];
  consignatario: NotfisParty | null;
  redespacho: NotfisRedispatch | null;
  responsavelFrete: NotfisFreightPayer | null;
};

export type NotfisRecipient = RecordValues<typeof R312> & { notas: NotfisInvoice[] };

export type NotfisShipper = RecordValues<typeof R311> & { destinatarios: NotfisRecipient[] };

export interface NotfisDocument {
  documento: string;
  embarcadoras: NotfisShipper[];
  totais: NotfisTotals | null;
}

/** Arquivo NOTFIS já estruturado em árvore, como descrito no manual. */
export interface NotfisFile {
  /** `null` apenas quando o arquivo não tem registro 000 (há um issue explicando). */
  cabecalho: NotfisHeader | null;
  documentos: NotfisDocument[];
}

/* ---------- Tipos de entrada para geração (quase tudo opcional) ---------- */

type Input<T> = { [K in keyof T]?: T[K] | null };

export type NotfisInvoiceInput = Input<RecordValues<typeof R313>> & {
  complemento?:
    | (Input<Omit<Raw333, JointKeys>> & { entregasCasadas?: Partial<NotfisJointDelivery>[] })
    | null;
  mercadorias?: Partial<NotfisItem>[];
  consignatario?: Input<NotfisParty> | null;
  redespacho?: Input<NotfisRedispatch> | null;
  responsavelFrete?: Input<NotfisFreightPayer> | null;
};

export type NotfisRecipientInput = Input<RecordValues<typeof R312>> & {
  notas: NotfisInvoiceInput[];
};

export type NotfisShipperInput = Input<RecordValues<typeof R311>> & {
  destinatarios: NotfisRecipientInput[];
};

export interface NotfisDocumentInput {
  documento?: string;
  embarcadoras: NotfisShipperInput[];
  /** Quando omitido, o registro 318 é calculado a partir das notas. */
  totais?: Input<NotfisTotals> | null;
}

export interface NotfisInput {
  /** `data`, `hora` e `intercambio` são preenchidos automaticamente se omitidos. */
  cabecalho?: Input<NotfisHeader> | null;
  documentos: NotfisDocumentInput[];
}
