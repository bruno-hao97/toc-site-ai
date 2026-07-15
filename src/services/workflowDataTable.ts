export interface TableRow {
  [key: string]: string;
}

export interface ParsedTable {
  rows: TableRow[];
  columns: string[];
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseTableInput(raw: string): ParsedTable {
  const text = raw.trim();
  if (!text) return { rows: [], columns: [] };

  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        const rows = parsed
          .filter((r) => r && typeof r === 'object' && !Array.isArray(r))
          .map((r) => {
            const row: TableRow = {};
            for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
              row[k] = String(v ?? '');
            }
            return row;
          });
        const columns = rows.length
          ? [...new Set(rows.flatMap((r) => Object.keys(r)))]
          : [];
        return { rows, columns };
      }
      if (parsed && typeof parsed === 'object') {
        const row: TableRow = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          row[k] = String(v ?? '');
        }
        return { rows: [row], columns: Object.keys(row) };
      }
    } catch {
      /* fall through to CSV */
    }
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], columns: [] };
  const header = parseCsvLine(lines[0]);
  const columns = header.length ? header : ['c1'];
  const rows: TableRow[] = [];
  const bodyLines = header.length > 1 || lines.length > 1 ? lines.slice(1) : lines;
  for (const line of bodyLines) {
    const cells = parseCsvLine(line);
    const row: TableRow = {};
    columns.forEach((col, i) => {
      row[col] = cells[i] ?? '';
    });
    rows.push(row);
  }
  return { rows, columns };
}

export function tableToJson(rows: TableRow[]): string {
  return JSON.stringify(rows);
}
