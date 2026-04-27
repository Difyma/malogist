import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const PRIORITY_LABEL = {
  critical: 'Критично',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
  safe: 'В норме',
}

const PRIORITY_COLORS = {
  critical: '#a32643',
  high: '#c45c2d',
  medium: '#b8860b',
  low: '#2d6a4f',
  safe: '#5c6bc0',
}

const SEVERITY_LABEL = {
  critical: '≤3 дн',
  high: '4–7 дн',
  medium: '8–14 дн',
  safe: '15+ дн',
}

const SEVERITY_COLORS = {
  critical: '#a32643',
  high: '#c45c2d',
  medium: '#b8860b',
  safe: '#5c6bc0',
}

const MP_LABEL = {
  wb: 'Wildberries',
  ozon: 'Ozon',
  yandex: 'Яндекс Маркет',
}

function severityFromDays(days) {
  const d = Number(days) || 0
  if (d <= 3) return 'critical'
  if (d <= 7) return 'high'
  if (d <= 14) return 'medium'
  return 'safe'
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="cabinet-chart-tooltip">
      {label != null ? <strong>{label}</strong> : null}
      {payload.map((p) => (
        <div key={p.dataKey}>
          {p.name}: {typeof p.value === 'number' ? p.value : p.value}
        </div>
      ))}
    </div>
  )
}

const HERO_TABS = [
  { id: 'priority', label: 'Приоритеты' },
  { id: 'marketplaces', label: 'Маркетплейсы' },
  { id: 'stocks', label: 'Остатки' },
  { id: 'oos', label: 'Дни до OOS' },
]

export function DashboardCharts({ recommendations, criticalStocks, hasSelection, variant = 'full' }) {
  const [heroTab, setHeroTab] = useState('priority')
  const prioritySlices = useMemo(() => {
    const counts = {}
    for (const r of recommendations) {
      const p = r.priority || 'safe'
      counts[p] = (counts[p] || 0) + 1
    }
    return Object.entries(counts).map(([key, value]) => ({
      name: PRIORITY_LABEL[key] || key,
      key,
      value,
    }))
  }, [recommendations])

  const marketplaceBars = useMemo(() => {
    const counts = {}
    for (const r of recommendations) {
      const mp = r.marketplaceType || '—'
      counts[mp] = (counts[mp] || 0) + 1
    }
    return Object.entries(counts)
      .map(([mp, count]) => ({ mp, label: MP_LABEL[mp] || mp, count }))
      .sort((a, b) => b.count - a.count)
  }, [recommendations])

  const stockSeverityBars = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, safe: 0 }
    for (const row of criticalStocks) {
      const sev = severityFromDays(row.daysUntilStockout)
      counts[sev] += 1
    }
    return ['critical', 'high', 'medium', 'safe'].map((key) => ({
      name: SEVERITY_LABEL[key],
      key,
      count: counts[key],
    }))
  }, [criticalStocks])

  const daysHistogram = useMemo(() => {
    const bins = [
      { name: '0–3 дн', n: 0 },
      { name: '4–7 дн', n: 0 },
      { name: '8–14 дн', n: 0 },
      { name: '15+ дн', n: 0 },
    ]
    for (const r of recommendations) {
      const d = Number(r.daysUntilStockout)
      if (Number.isNaN(d)) continue
      if (d <= 3) bins[0].n += 1
      else if (d <= 7) bins[1].n += 1
      else if (d <= 14) bins[2].n += 1
      else bins[3].n += 1
    }
    return bins.map(({ name, n }) => ({ name, count: n }))
  }, [recommendations])

  if (!hasSelection) {
    const emptyMsg = (
      <p className="muted cabinet-chart-empty-msg">Отметьте магазины в «Источниках данных».</p>
    )
    if (variant === 'hero') {
      return <div className="cabinet-hero-chart cabinet-hero-chart--empty">{emptyMsg}</div>
    }
    return (
      <section className="cabinet-card cabinet-charts">
        <h3>Сводка по выбранным магазинам</h3>
        {emptyMsg}
      </section>
    )
  }

  const empty = !recommendations.length && !criticalStocks.length

  if (variant === 'hero') {
    return (
      <div className="cabinet-hero-chart">
        {empty ? (
          <p className="muted cabinet-chart-empty-msg">
            Нет данных — подключите интеграцию и синхронизируйте каталог.
          </p>
        ) : (
          <>
            <div className="cabinet-hero-chart-body">
              {heroTab === 'priority' && prioritySlices.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={prioritySlices}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={64}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {prioritySlices.map((entry) => (
                        <Cell key={entry.key} fill={PRIORITY_COLORS[entry.key] || '#888'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : null}
              {heroTab === 'marketplaces' && marketplaceBars.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={marketplaceBars} layout="vertical" margin={{ left: 8, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(80,100,160,0.12)" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} formatter={(v) => [v, 'Шт.']} />
                    <Bar dataKey="count" name="Рекомендаций" fill="#3f62ff" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
              {heroTab === 'stocks' && criticalStocks.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stockSeverityBars} margin={{ left: 4, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(80,100,160,0.12)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Позиций">
                      {stockSeverityBars.map((entry) => (
                        <Cell key={entry.key} fill={SEVERITY_COLORS[entry.key] || '#888'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
              {heroTab === 'oos' && recommendations.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={daysHistogram} margin={{ left: 4, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(80,100,160,0.12)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="SKU" fill="#6a49f7" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
              {!empty &&
              ((heroTab === 'priority' && !prioritySlices.length) ||
                (heroTab === 'marketplaces' && !marketplaceBars.length) ||
                (heroTab === 'stocks' && !criticalStocks.length) ||
                (heroTab === 'oos' && !recommendations.length)) ? (
                <p className="muted cabinet-chart-empty">Нет данных для этой вкладки</p>
              ) : null}
            </div>
            <div className="cabinet-chart-tabs" role="tablist" aria-label="Тип графика">
              {HERO_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={heroTab === t.id}
                  className={`cabinet-chart-tab ${heroTab === t.id ? 'active' : ''}`}
                  onClick={() => setHeroTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <section className="cabinet-card cabinet-charts">
      <h3>Сводка по выбранным магазинам</h3>
      {empty ? (
        <p className="muted">Нет данных для графиков — подключите интеграцию и выполните синхронизацию.</p>
      ) : (
        <div className="cabinet-chart-grid">
          <div className="cabinet-chart-panel">
            <h4>Рекомендации по приоритету</h4>
            <div className="cabinet-chart-body">
              {prioritySlices.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={prioritySlices}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {prioritySlices.map((entry) => (
                        <Cell key={entry.key} fill={PRIORITY_COLORS[entry.key] || '#888'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="muted cabinet-chart-empty">Нет рекомендаций</p>
              )}
            </div>
          </div>

          <div className="cabinet-chart-panel">
            <h4>Рекомендации по маркетплейсам</h4>
            <div className="cabinet-chart-body cabinet-chart-body--tall">
              {marketplaceBars.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={marketplaceBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(80,100,160,0.12)" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={108} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} formatter={(v) => [v, 'Шт.']} />
                    <Bar dataKey="count" name="Рекомендаций" fill="#3f62ff" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="muted cabinet-chart-empty">Нет данных</p>
              )}
            </div>
          </div>

          <div className="cabinet-chart-panel">
            <h4>Критичные остатки по срочности</h4>
            <div className="cabinet-chart-body">
              {criticalStocks.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stockSeverityBars} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(80,100,160,0.12)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Позиций">
                      {stockSeverityBars.map((entry) => (
                        <Cell key={entry.key} fill={SEVERITY_COLORS[entry.key] || '#888'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="muted cabinet-chart-empty">Нет критичных остатков</p>
              )}
            </div>
          </div>

          <div className="cabinet-chart-panel">
            <h4>Распределение дней до OOS (рекомендации)</h4>
            <div className="cabinet-chart-body">
              {recommendations.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={daysHistogram} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(80,100,160,0.12)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="SKU" fill="#6a49f7" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="muted cabinet-chart-empty">Нет рекомендаций</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
