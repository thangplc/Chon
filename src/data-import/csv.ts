import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { parse } from "csv-parse/sync";

import { ImportError, type ImportFile } from "./types";

export type CsvRecord = Readonly<Record<string, string>>;

export type ParsedCsv = Readonly<{
  file: ImportFile;
  headers: readonly string[];
  records: readonly CsvRecord[];
}>;

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function readCsv(filePath: string): Promise<ParsedCsv> {
  const content = await readFile(filePath, "utf8");
  const fileName = basename(filePath);
  let headers: string[] = [];
  let records: CsvRecord[];

  try {
    records = parse(content, {
      bom: true,
      columns: (inputHeaders: string[]) => {
        headers = inputHeaders;
        return inputHeaders;
      },
      relax_column_count: false,
      skip_empty_lines: true,
    }) as CsvRecord[];
  } catch (error) {
    throw new ImportError(`Cannot parse ${fileName}`, [
      {
        code: "invalid_csv",
        file: fileName,
        message: error instanceof Error ? error.message : "Invalid CSV",
        severity: "error",
      },
    ]);
  }

  if (headers.length === 0) {
    throw new ImportError(`CSV has no header: ${fileName}`, [
      {
        code: "missing_header",
        file: fileName,
        message: "CSV must contain a header row",
        severity: "error",
      },
    ]);
  }

  const duplicateHeaders = headers.filter(
    (header, index) => headers.indexOf(header) !== index,
  );

  if (duplicateHeaders.length > 0) {
    throw new ImportError(`CSV has duplicate headers: ${fileName}`, [
      {
        code: "duplicate_header",
        file: fileName,
        message: `Duplicate headers: ${[...new Set(duplicateHeaders)].join(", ")}`,
        severity: "error",
      },
    ]);
  }

  return {
    file: {
      checksum: sha256(content),
      name: fileName,
      records: records.length,
    },
    headers,
    records,
  };
}
