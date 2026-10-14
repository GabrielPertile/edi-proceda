/**
 * Exemplo: ler um NOTFIS e listar as notas por destinatário.
 * Rode com: npx tsx examples/ler-notfis.ts test/fixtures/notfis31-exemplo.txt
 */
import { readFileSync } from "node:fs";
import { parseNotfis } from "../src/index.js";

const file = process.argv[2] ?? "test/fixtures/notfis31-exemplo.txt";
const { ok, data, issues } = parseNotfis(readFileSync(file, "latin1"));

for (const issue of issues) console.warn(`[${issue.code}] linha ${issue.line}: ${issue.message}`);
if (!ok) process.exit(1);

for (const doc of data.documentos) {
  for (const embarcadora of doc.embarcadoras) {
    for (const dest of embarcadora.destinatarios) {
      console.log(`\n${dest.razaoSocial} (${dest.cidade}/${dest.uf})`);
      for (const nf of dest.notas) {
        const valor = nf.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        console.log(`  NF ${nf.serie}-${nf.numero}  ${valor}  ${nf.peso} kg  ${nf.volumes} vol.`);
      }
    }
  }
}
