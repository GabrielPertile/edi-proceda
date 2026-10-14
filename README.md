# edi-proceda

[![CI](https://github.com/GabrielPertile/edi-proceda/actions/workflows/ci.yml/badge.svg)](https://github.com/GabrielPertile/edi-proceda/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/edi-proceda.svg)](https://www.npmjs.com/package/edi-proceda)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Parser, gerador e validador **tipado** para arquivos EDI de transporte no padrão **PROCEDA**, usados entre embarcadores e transportadoras no Brasil.

> 🇺🇸 *Typed TypeScript parser, generator and validator for PROCEDA EDI files (NOTFIS, OCOREN, CONEMB, DOCCOB), the de facto standard for shipper–carrier data exchange in Brazil. See [English summary](#english-summary).*

Quem já integrou ERP com transportadora conhece o problema: arquivos de largura fixa, posições contadas na mão, decimais implícitos, datas `DDMMAAAA`, e um erro de uma posição que só aparece quando a transportadora rejeita o arquivo. Esta biblioteca transforma isso em objetos tipados e devolve cada problema com **linha, registro, campo e posição**.

| Layout | Versão | Status |
| --- | --- | --- |
| NOTFIS (notas fiscais) | 3.1 | ✅ leitura e geração |
| NOTFIS | 5.0 | 🗺️ planejado |
| OCOREN (ocorrências) | 3.1 / 5.0 | 🗺️ planejado |
| CONEMB (conhecimentos) | 3.1 / 5.0 | 🗺️ planejado |
| DOCCOB (cobrança) | 3.1 / 5.0 | 🗺️ planejado |

## Instalação

```bash
npm install edi-proceda
```

Requer Node.js 20+. Sem dependências em runtime.

## Ler um NOTFIS

```ts
import { readFileSync } from "node:fs";
import { parseNotfis } from "edi-proceda";

const { ok, data, issues } = parseNotfis(readFileSync("NOTFIS.TXT", "latin1"));

for (const issue of issues) {
  console.warn(`[${issue.code}] linha ${issue.line}, campo ${issue.field}: ${issue.message}`);
}

for (const doc of data.documentos)
  for (const embarcadora of doc.embarcadoras)
    for (const destinatario of embarcadora.destinatarios)
      for (const nota of destinatario.notas) {
        nota.numero;      // "00001234"
        nota.dataEmissao; // "2026-10-14"
        nota.valorTotal;  // 15432.1
        nota.mercadorias; // [{ volumes, especie, mercadoria }, ...]
      }
```

O resultado segue a hierarquia do manual: `000` → `310` → `311` → `312` → `313` (com `333`, `314`, `315`, `316`, `317` pendurados na nota) e `318` fechando cada documento.

### Validações incluídas

| Código | Severidade | O que verifica |
| --- | --- | --- |
| `LINE_LENGTH` | aviso / erro | Registro diferente de 240 posições (curto é aviso, longo é erro) |
| `UNKNOWN_RECORD` | erro | Identificador de registro inexistente no layout |
| `UNEXPECTED_RECORD` | erro | Registro fora da hierarquia (ex.: `313` sem `312` antes) |
| `MISSING_RECORD` | erro | Arquivo sem `000` ou documento sem `318` |
| `REQUIRED_FIELD` | erro | Campo obrigatório (`M` no manual) vazio |
| `INVALID_NUMERIC` / `INVALID_DATE` / `INVALID_TIME` | erro | Conteúdo incompatível com o formato do campo |
| `INVALID_CNPJ` / `INVALID_CPF` | aviso | Dígito verificador inválido |
| `TOTALS_MISMATCH` | aviso | Registro `318` diferente da soma das notas |
| `DUPLICATE_RECORD` | aviso | Mais de um `333`/`315`/`316`/`317` por nota |

`parseNotfis` **nunca lança exceção**: tudo que foi possível ler vem em `data`, e `ok` é `false` se houver algum erro.

## Gerar um NOTFIS

```ts
import { generateNotfis } from "edi-proceda";

const arquivo = generateNotfis({
  cabecalho: { remetente: "EMBARCADORA", destinatario: "TRANSPORTADORA" },
  documentos: [
    {
      embarcadoras: [
        {
          cnpj: "11.222.333/0001-81",
          razaoSocial: "Indústria Exemplo",
          dataEmbarque: "2026-10-15",
          destinatarios: [
            {
              razaoSocial: "Comércio Fictício",
              cnpjCpf: "98765432000198",
              cep: "01000-000",
              notas: [
                {
                  condicaoFrete: "C",
                  numero: "1234",
                  dataEmissao: "2026-10-14",
                  natureza: "Peças",
                  especie: "Caixas",
                  volumes: 10,
                  valorTotal: 15432.1,
                  peso: 250.5,
                  tipoIcms: "S",
                  seguroEfetuado: "N",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});
```

- Campos omitidos são preenchidos com brancos ou zeros, como pede o manual.
- Texto vira maiúsculo e sem acentos (`normalizeText: false` desliga).
- CNPJ, CEP e afins aceitam máscara; só os dígitos são gravados.
- O registro `318` é calculado automaticamente quando `totais` não é informado, somando em centavos para não acumular erro de ponto flutuante.
- Valores que não cabem no campo lançam `EdiFormatError` em vez de serem cortados silenciosamente. Texto longo é truncado por padrão (`truncateText: false` muda isso).
- Quebra de linha padrão `\r\n`, configurável.

## CLI

```bash
npx edi-proceda notfis NOTFIS.TXT            # JSON em stdout, problemas em stderr
npx edi-proceda notfis NOTFIS.TXT --issues   # só a validação; sai com código 1 se houver erro
```

## Layouts próprios

O núcleo é genérico. Cada registro é descrito de forma declarativa, com posições iguais às do manual, e os tipos TypeScript são inferidos da definição:

```ts
import { defineRecord, text, digits, decimal, date, filler, parseRecord } from "edi-proceda";

const R340 = defineRecord({
  id: "340",
  name: "Cabeçalho de documento",
  length: 120,
  fields: [text("documento", 4, 14, { required: true }), filler(18, 103)],
});

const { values } = parseRecord(R340, linha); // values.documento: string
```

Isso também serve para as variações "personalizadas" que muitos ERPs e transportadoras usam.

## Decisões de projeto

- **O layout é dado, não código.** Os registros ficam em [`src/notfis/layout.ts`](src/notfis/layout.ts) e um teste garante que os campos de cada registro são contíguos e somam exatamente 240 posições. Erro de digitação de posição quebra o CI, não a integração.
- **Ida e volta sem perda.** `generateNotfis(parseNotfis(arquivo).data)` reproduz o arquivo byte a byte.
- **Erros acionáveis.** Cada problema traz linha, registro, campo e posição do manual, para responder "o que está errado e onde" sem abrir o arquivo num editor de colunas.
- **CNPJ alfanumérico.** O validador de CNPJ já suporta o novo formato alfanumérico da Receita Federal. Os campos de CNPJ do NOTFIS 3.1, porém, são numéricos (`N 14`) por definição do layout.

## Encoding

Arquivos EDI costumam vir em ISO-8859-1 (latin1). Leia com `readFileSync(arquivo, "latin1")` para preservar acentos; a CLI já usa latin1 por padrão (`--encoding utf8` muda).

## Desenvolvimento

```bash
npm install
npm test          # Vitest
npm run lint      # Biome
npm run typecheck
npm run build     # tsup: ESM + CJS + .d.ts
```

Contribuições são bem-vindas, especialmente arquivos de exemplo **anonimizados** de casos reais que a biblioteca ainda não trata. Para um novo layout, comece pela definição dos registros e pelo teste de integridade de posições.

## Fontes

- Manual PROCEDA NOTFIS 3.1 (revisão de 28/03/2000), disponibilizado publicamente por fornecedores de TMS/ERP.

PROCEDA é um padrão de mercado; este projeto não tem relação com a empresa que o originou.

## English summary

`edi-proceda` reads and writes PROCEDA EDI files, the fixed-width format Brazilian shippers and carriers use to exchange invoices (NOTFIS), delivery events (OCOREN), freight bills (CONEMB) and billing (DOCCOB). It currently supports NOTFIS 3.1 with fully typed output, lossless round-tripping, CNPJ/CPF check-digit validation and totals reconciliation. Every issue is reported with line, record, field and position instead of throwing. Layouts are declarative data, verified by tests, so adding a new version is mostly transcribing the spec.

## Licença

[MIT](LICENSE)
