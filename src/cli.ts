import { readFileSync } from "node:fs";
import { parseNotfis } from "./notfis/parse.js";

const HELP = `Uso: edi-proceda notfis <arquivo> [opções]

Lê um arquivo NOTFIS 3.1, imprime o JSON em stdout e os problemas em stderr.
Sai com código 1 se houver erros.

Opções:
  --issues        mostra apenas os problemas encontrados
  --encoding <e>  encoding do arquivo (padrão: latin1)
  -h, --help      mostra esta ajuda`;

function main(argv: string[]): number {
  const [command, file, ...rest] = argv;
  if (!command || command === "-h" || command === "--help") {
    console.log(HELP);
    return 0;
  }
  if (command !== "notfis" || !file) {
    console.error(HELP);
    return 2;
  }

  const encIndex = rest.indexOf("--encoding");
  const encoding = (encIndex >= 0 ? rest[encIndex + 1] : "latin1") as BufferEncoding;
  const onlyIssues = rest.includes("--issues");

  const result = parseNotfis(readFileSync(file, { encoding }));

  for (const i of result.issues) {
    const where = [i.line && `linha ${i.line}`, i.record && `reg. ${i.record}`, i.field]
      .filter(Boolean)
      .join(", ");
    console.error(
      `${i.severity === "error" ? "ERRO " : "AVISO"} [${i.code}] ${where}: ${i.message}`,
    );
  }
  if (!onlyIssues) console.log(JSON.stringify(result.data, null, 2));
  if (onlyIssues && result.issues.length === 0) console.error("Nenhum problema encontrado.");

  return result.ok ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
