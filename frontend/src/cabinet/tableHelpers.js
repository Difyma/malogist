export function normalizeSearch(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
}

export function sortRows(rows, getValue, direction = 'asc') {
  const mult = direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = getValue(a)
    const vb = getValue(b)
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult
    return String(va).localeCompare(String(vb), 'ru') * mult
  })
}

export function paginateSlice(rows, page, pageSize) {
  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), pages)
  const start = (safePage - 1) * pageSize
  return { slice: rows.slice(start, start + pageSize), total, pages, page: safePage }
}

export function downloadCsv(filename, headers, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const sep = ';'
  const bom = '\uFEFF'
  const lines = [headers.map(esc).join(sep), ...rows.map((r) => r.map(esc).join(sep))]
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
