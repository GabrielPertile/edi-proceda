# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.0] - 2026-10-14

### Adicionado
- Núcleo genérico de registros de largura fixa com tipos inferidos do layout.
- NOTFIS 3.1: leitura (`parseNotfis`) e geração (`generateNotfis`) dos registros 000, 310, 311, 312, 313, 314, 315, 316, 317, 318 e 333.
- Validação de estrutura, campos obrigatórios, formatos, CNPJ/CPF (incluindo CNPJ alfanumérico) e conferência do registro 318.
- CLI `edi-proceda notfis`.
