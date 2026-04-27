function quote(value) {
  const text = String(value ?? '').replaceAll('"', '""')
  return `"${text}"`
}

export function toCsv(rows) {
  const body = rows.map((row) => row.map(quote).join(';')).join('\n')
  return `\uFEFF${body}`
}
