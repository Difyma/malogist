import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DashboardCharts } from './cabinet/DashboardCharts.jsx'
import { downloadCsv, normalizeSearch, paginateSlice, sortRows } from './cabinet/tableHelpers.js'
import './App.css'

const TABLE_PAGE_SIZE = 15

const REC_PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, safe: 4 }

function SortableTh({ label, sortKey, sort, onToggle, align = 'left' }) {
  const active = sort.key === sortKey
  const mark = active ? (sort.dir === 'asc' ? '↑' : '↓') : ''
  return (
    <th style={{ textAlign: align }} className={active ? 'cabinet-th-sort-active' : undefined}>
      <button type="button" className="cabinet-sort-btn" onClick={() => onToggle(sortKey)}>
        {label}
        {mark ? (
          <span className="cabinet-sort-mark" aria-hidden="true">
            {mark}
          </span>
        ) : null}
      </button>
    </th>
  )
}

const MARKETPLACE_LABELS = {
  wb: 'Wildberries',
  ozon: 'Ozon',
  yandex: 'Яндекс Маркет',
}

const PRIORITY_LABELS = {
  critical: 'Критично',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
  safe: 'В норме',
}

const INTEGRATION_STATUS_LABELS = {
  active: 'Активна',
  error: 'Ошибка',
  disabled: 'Отключена',
}

const CABINET_RAIL_PAGES = [
  { id: 'dashboard', label: 'Дашборд', icon: '▣' },
  { id: 'recommendations', label: 'Рекомендации', icon: '☰' },
  { id: 'settings', label: 'Настройки прогноза', icon: '⚙' },
  { id: 'notifications', label: 'Уведомления', icon: '✉' },
  { id: 'integrations', label: 'Интеграции', icon: '⛓' },
]

function marketplaceKey(account) {
  return account.marketplaceType || account.marketplace
}

function formatPriority(priority) {
  if (!priority) return '—'
  return PRIORITY_LABELS[priority] || priority
}

function formatIntegrationStatus(status) {
  if (!status) return '—'
  return INTEGRATION_STATUS_LABELS[status] || status
}

/** Vite отдаёт в клиент только VITE_* (см. .env в frontend). */
function devOzonDefaults() {
  const apiKey = import.meta.env.VITE_OZON_API_KEY
  const clientId = import.meta.env.VITE_OZON_CLIENT_ID
  return {
    apiKey: typeof apiKey === 'string' ? apiKey : '',
    clientId: typeof clientId === 'string' ? clientId : clientId != null ? String(clientId) : '',
  }
}

const DEMAND_NODE_HINTS = {
  high: 'Много покупок · товар в движении',
  medium: 'Стабильные продажи',
  low: 'Мало заказов · остатки на исходе',
}

const fallbackData = {
  hero: {
    eyebrow: 'Умный диспетчер складов для Wildberries, Ozon и Яндекс Маркет',
    title:
      'Управляй логистикой на маркетплейсах и перестань терять деньги на складах',
    subtitle:
      'Сервис сам показывает, куда и сколько товара отправить, чтобы не было out-of-stock и лишних расходов на логистику.',
    ctaPrimary: 'Попробовать бесплатно',
    ctaSecondary: 'Посмотреть прогноз',
    trust: 'Работает с Wildberries, Ozon и Яндекс Маркет',
  },
  painPoints: [
    'Товар заканчивается в нужных регионах и продажи проседают.',
    'Часть остатков лежит мертвым грузом на “не тех” складах.',
    'Логистика съедает маржу из-за коэффициентов маркетплейсов.',
    'Поставки планируются “на глаз” вместо расчетов.',
  ],
  steps: [
    'Подключаешь кабинеты маркетплейсов и подтягиваешь остатки из учетной системы.',
    'Сервис анализирует спрос, регионы, скорость продаж и коэффициенты.',
    'Получаешь готовые действия: куда везти, сколько отправить, где будет out-of-stock.',
  ],
  smartActions: [
    'SKU 123 → отправь +200 шт в Москву',
    'SKU 456 → не пополняй склад в Новосибирске',
    'SKU 789 → закончится через 4 дня',
  ],
  regions: [
    { city: 'Москва', share: 40, demand: 'high', x: 35, y: 39 },
    { city: 'Санкт-Петербург', share: 20, demand: 'medium', x: 31, y: 33 },
    { city: 'Казань', share: 10, demand: 'medium', x: 39, y: 42 },
    { city: 'Екатеринбург', share: 9, demand: 'low', x: 49, y: 43 },
    { city: 'Новосибирск', share: 8, demand: 'low', x: 60, y: 45 },
    { city: 'Краснодар', share: 7, demand: 'medium', x: 29, y: 53 },
    { city: 'Владивосток', share: 6, demand: 'low', x: 84, y: 50 },
  ],
  stockAlerts: [
    'Склад Москва: остатка хватит на 3 дня',
    'Склад СПб: прогноз out-of-stock через 5 дней',
    'SKU 123: требуется пополнение в Казани до конца недели',
  ],
  logisticsFactors: [
    'Стоимость хранения',
    'Стоимость доставки',
    'Коэффициенты складов',
    'Дорогие регионы',
  ],
  recommendations: [
    {
      sku: 'SKU 123',
      warehouse: 'Москва',
      stock: 50,
      daysLeft: 3,
      recommendation: 200,
      action: 'Пополнить',
    },
    {
      sku: 'SKU 123',
      warehouse: 'СПб',
      stock: 120,
      daysLeft: 10,
      recommendation: 80,
      action: 'Пополнить',
    },
    {
      sku: 'SKU 456',
      warehouse: 'Казань',
      stock: 240,
      daysLeft: 24,
      recommendation: 0,
      action: 'Не везти',
    },
    {
      sku: 'SKU 789',
      warehouse: 'Москва',
      stock: 45,
      daysLeft: 4,
      recommendation: 140,
      action: 'Срочно пополнить',
    },
  ],
  forecastHorizonDays: [14, 28, 30],
  audience: [
    'Продаешь на Wildberries и/или Ozon',
    'Делаешь регулярные поставки',
    'Хочешь расти без хаоса в логистике',
    'Устал считать все вручную в Excel',
  ],
  economics: [
    { label: 'Снижение out-of-stock', value: 0, suffix: '%' },
    { label: 'Экономия на логистике', value: 20, suffix: '%' },
    { label: 'Рост выручки у активных селлеров', value: 35, suffix: '%' },
  ],
  pricingPlans: [
    {
      name: 'Free',
      tag: 'Вход',
      monthly: 0,
      annual: 0,
      skuLimit: 'до 20 SKU',
      description: 'Почувствовать ценность за 1 день',
      features: ['1 маркетплейс', 'Базовые остатки', '1 прогноз в день'],
    },
    {
      name: 'Start',
      tag: 'Основной',
      monthly: 4990,
      annual: 3990,
      skuLimit: 'до 200 SKU',
      description: 'Для мелких и средних селлеров',
      features: ['Все маркетплейсы', 'Прогноз 14/28 дней', 'Telegram-уведомления'],
    },
    {
      name: 'Pro',
      tag: 'Максимум ROI',
      monthly: 19990,
      annual: 14990,
      skuLimit: 'до 1000 SKU',
      description: 'Оптимизация логистики и маржи',
      features: ['Коэффициенты складов', 'Карта спроса', 'Перераспределение'],
      featured: true,
    },
    {
      name: 'Business',
      tag: 'Для команд',
      monthly: 79990,
      annual: 59990,
      skuLimit: 'безлимит SKU',
      description: 'Крупные селлеры и multi-user команды',
      features: ['API доступ', 'Интеграция 1С/МойСклад', 'Кастомные правила'],
    },
    {
      name: 'Enterprise',
      tag: 'Индивидуально',
      monthly: null,
      annual: null,
      skuLimit: 'индивидуально',
      description: 'SLA, white-label, кастомная логика',
      features: ['Выделенный контур', 'Приоритетная поддержка', 'Отдельные расчеты'],
    },
  ],
}

const numberFormatter = new Intl.NumberFormat('ru-RU')
const demoAuth = {
  email: 'demo@malogist.ru',
  password: 'demo12345',
}

function buildFallbackCriticalSkus(recommendations, thresholdDays) {
  return recommendations
    .filter((item) => item.daysLeft <= thresholdDays)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .map((item) => ({
      ...item,
      riskLevel: item.daysLeft <= 3 ? 'critical' : 'warning',
    }))
}

function parseFileNameFromDisposition(value) {
  if (!value) return null
  const match = value.match(/filename="([^"]+)"/i)
  return match ? match[1] : null
}

function getSeverityByDays(daysLeft) {
  if (daysLeft <= 3) return 'critical'
  if (daysLeft <= 7) return 'high'
  if (daysLeft <= 14) return 'medium'
  return 'safe'
}

function getRecommendationNote(item) {
  const severity = getSeverityByDays(item.daysLeft)
  if (severity === 'critical') return 'Срочно пополнить'
  if (severity === 'high') return 'Высокий риск OOS'
  if (severity === 'medium') return 'Нужен контроль'
  if (item.recommendation > 0) return 'Плановое пополнение'
  return 'Запас достаточный'
}

async function authFetch(path, token, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new Error(payload?.message || `Ошибка запроса (${response.status})`)
  }

  return payload
}

function marketplaceLabel(code) {
  if (code === 'wb') return 'Wildberries'
  if (code === 'ozon') return 'Ozon'
  if (code === 'yandex') return 'Яндекс Маркет'
  return code || 'unknown'
}

function LoginView({ onLoginSuccess, onBack }) {
  const [form, setForm] = useState(demoAuth)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const payload = await authFetch('/api/auth/login', '', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      onLoginSuccess(payload)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="cabinet-page">
      <div className="cabinet-shell">
        <button type="button" className="button button-outline" onClick={onBack}>
          ← На главную
        </button>

        <form className="cabinet-card" onSubmit={handleSubmit}>
          <h2>Вход в кабинет селлера</h2>
          <p>Демо-доступ: demo@malogist.ru / demo12345</p>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              required
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              required
            />
          </label>

          <button type="submit" className="button button-solid" disabled={isLoading}>
            {isLoading ? 'Входим...' : 'Войти'}
          </button>
          {error ? <p className="api-error">{error}</p> : null}
        </form>
      </div>
    </div>
  )
}

function SellerCabinet({ token, user, onBack, onLogout }) {
  const [activePage, setActivePage] = useState('dashboard')
  const [accounts, setAccounts] = useState([])
  const [products, setProducts] = useState([])
  const [selectedMarketplaces, setSelectedMarketplaces] = useState([])
  const [selectedAccountIds, setSelectedAccountIds] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [criticalStocks, setCriticalStocks] = useState([])
  const [integrations, setIntegrations] = useState([])
  const [integrationForm, setIntegrationForm] = useState({
    marketplace: 'wb',
    name: 'Новый кабинет',
    apiKey: '',
    clientId: '',
    externalBusinessId: '',
    externalCampaignId: '',
  })
  const [isIntegrationLoading, setIsIntegrationLoading] = useState(false)
  const [editingIntegrationId, setEditingIntegrationId] = useState(null)
  const prevAccountIdsRef = useRef(null)
  const [dashStockSort, setDashStockSort] = useState({ key: 'daysUntilStockout', dir: 'asc' })
  const [dashStockQuery, setDashStockQuery] = useState('')
  const [dashStockPage, setDashStockPage] = useState(1)
  const [recSort, setRecSort] = useState({ key: 'priority', dir: 'asc' })
  const [recQuery, setRecQuery] = useState('')
  const [recPage, setRecPage] = useState(1)
  const [notifications, setNotifications] = useState({
    telegramEnabled: false,
    emailEnabled: false,
    stockoutAlertDays: 5,
  })
  const [forecastSettings, setForecastSettings] = useState({
    forecastDays: 28,
    safetyStockDays: 5,
    minStockUnits: 0,
    targetTurnoverDays: 28,
    strategy: 'balanced',
  })
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isForecastLoading, setIsForecastLoading] = useState(false)
  const marketplaceCheckboxRefs = useRef({})

  const marketplaceOptions = useMemo(
    () => [...new Set(accounts.map((item) => marketplaceKey(item)))].filter(Boolean),
    [accounts],
  )

  const accountById = useMemo(() => new Map(accounts.map((item) => [item.id, item])), [accounts])

  const activeAccountIds = useMemo(() => {
    const selectedMarketplaceSet = new Set(selectedMarketplaces)
    const selectedAccountSet = new Set(selectedAccountIds)

    return accounts
      .filter(
        (item) =>
          selectedMarketplaceSet.has(marketplaceKey(item)) && selectedAccountSet.has(item.id),
      )
      .map((item) => item.id)
  }, [accounts, selectedAccountIds, selectedMarketplaces])

  const effectiveAccountId = activeAccountIds.length ? activeAccountIds[0] : null

  const productAccountById = useMemo(
    () => new Map(products.map((item) => [item.id, item.accountId])),
    [products],
  )

  useEffect(() => {
    for (const mp of marketplaceOptions) {
      const el = marketplaceCheckboxRefs.current[mp]
      if (!el) continue
      const group = accounts.filter((a) => marketplaceKey(a) === mp)
      const n = group.filter((a) => selectedAccountIds.includes(a.id)).length
      el.indeterminate = n > 0 && n < group.length
    }
  }, [accounts, marketplaceOptions, selectedAccountIds])

  const dashboardRecommendations = useMemo(
    () =>
      recommendations.filter((item) => activeAccountIds.includes(Number(item.accountId))),
    [recommendations, activeAccountIds],
  )

  const dashboardCriticalStocks = useMemo(
    () =>
      criticalStocks.filter((item) =>
        activeAccountIds.includes(productAccountById.get(item.productId)),
      ),
    [criticalStocks, activeAccountIds, productAccountById],
  )

  const criticalRecommendations = useMemo(
    () => dashboardRecommendations.filter((item) => ['critical', 'high'].includes(item.priority)),
    [dashboardRecommendations],
  )

  const filteredRecommendations = useMemo(
    () =>
      recommendations.filter((item) => activeAccountIds.includes(Number(item.accountId ?? 0))),
    [recommendations, activeAccountIds],
  )

  const processedDashStocks = useMemo(() => {
    const getters = {
      marketplace: (r) => {
        const accId = productAccountById.get(r.productId)
        const acc = accId != null ? accountById.get(accId) : null
        const mp = acc ? marketplaceKey(acc) : ''
        return MARKETPLACE_LABELS[mp] || mp || ''
      },
      account: (r) => {
        const accId = productAccountById.get(r.productId)
        return accountById.get(accId)?.name || ''
      },
      sku: (r) => r.sku || '',
      warehouse: (r) => r.warehouse || '',
      stock: (r) => Number(r.stock) || 0,
      daysUntilStockout: (r) => Number(r.daysUntilStockout) || 0,
    }

    let rows = [...dashboardCriticalStocks]
    const q = normalizeSearch(dashStockQuery)
    if (q) {
      rows = rows.filter((r) => {
        const blob = [
          getters.marketplace(r),
          getters.account(r),
          getters.sku(r),
          getters.warehouse(r),
          String(r.stock),
          String(r.daysUntilStockout),
        ]
          .join(' ')
          .toLowerCase()
        return blob.includes(q)
      })
    }

    const getter = getters[dashStockSort.key] || ((r) => r[dashStockSort.key])
    return sortRows(rows, getter, dashStockSort.dir)
  }, [dashboardCriticalStocks, dashStockQuery, dashStockSort, productAccountById, accountById])

  const dashStockPageData = useMemo(
    () => paginateSlice(processedDashStocks, dashStockPage, TABLE_PAGE_SIZE),
    [processedDashStocks, dashStockPage],
  )

  const processedRecommendations = useMemo(() => {
    const getters = {
      marketplace: (r) => MARKETPLACE_LABELS[r.marketplaceType] || r.marketplaceType || '',
      account: (r) => r.accountName || '',
      sku: (r) => r.sku || '',
      warehouse: (r) => r.warehouse || '',
      currentStock: (r) => Number(r.currentStock) || 0,
      daysUntilStockout: (r) => Number(r.daysUntilStockout) || 0,
      recommendedQuantity: (r) => Number(r.recommendedQuantity) || 0,
      priority: (r) => REC_PRIORITY_ORDER[r.priority] ?? 99,
    }

    let rows = [...filteredRecommendations]
    const q = normalizeSearch(recQuery)
    if (q) {
      rows = rows.filter((r) => {
        const blob = [
          getters.marketplace(r),
          getters.account(r),
          getters.sku(r),
          getters.warehouse(r),
          String(r.currentStock),
          String(r.daysUntilStockout),
          String(r.recommendedQuantity),
          formatPriority(r.priority),
        ]
          .join(' ')
          .toLowerCase()
        return blob.includes(q)
      })
    }

    const getter = getters[recSort.key] || ((r) => r[recSort.key])
    return sortRows(rows, getter, recSort.dir)
  }, [filteredRecommendations, recQuery, recSort])

  const recPageData = useMemo(
    () => paginateSlice(processedRecommendations, recPage, TABLE_PAGE_SIZE),
    [processedRecommendations, recPage],
  )

  const toggleDashStockSort = (key) => {
    setDashStockSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
    setDashStockPage(1)
  }

  const toggleRecSort = (key) => {
    setRecSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
    setRecPage(1)
  }

  const exportDashStocksCsv = () => {
    const headers = ['Маркетплейс', 'Магазин', 'Артикул', 'Склад', 'Остаток', 'Дней запаса']
    const rows = processedDashStocks.map((item) => {
      const accId = productAccountById.get(item.productId)
      const acc = accId != null ? accountById.get(accId) : null
      const mp = acc ? marketplaceKey(acc) : ''
      return [
        MARKETPLACE_LABELS[mp] || mp || '',
        acc?.name ?? '',
        item.sku,
        item.warehouse,
        item.stock,
        item.daysUntilStockout,
      ]
    })
    downloadCsv(`critical-stocks-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  const exportRecommendationsCsv = () => {
    const headers = [
      'Маркетплейс',
      'Магазин',
      'Артикул',
      'Склад',
      'Остаток',
      'Дней запаса',
      'К поставке',
      'Приоритет',
    ]
    const rows = processedRecommendations.map((item) => [
      MARKETPLACE_LABELS[item.marketplaceType] || item.marketplaceType || '',
      item.accountName || '',
      item.sku,
      item.warehouse,
      item.currentStock,
      item.daysUntilStockout,
      item.recommendedQuantity,
      formatPriority(item.priority),
    ])
    downloadCsv(`recommendations-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  useEffect(() => {
    setDashStockPage(1)
  }, [dashStockQuery])

  useEffect(() => {
    setRecPage(1)
  }, [recQuery])

  const toggleMarketplaceGroup = (mp, nextChecked) => {
    const ids = accounts.filter((a) => marketplaceKey(a) === mp).map((a) => a.id)
    if (nextChecked) {
      setSelectedMarketplaces((prev) => [...new Set([...prev, mp])])
      setSelectedAccountIds((prev) => [...new Set([...prev, ...ids])])
    } else {
      setSelectedMarketplaces((prev) => prev.filter((x) => x !== mp))
      setSelectedAccountIds((prev) => prev.filter((id) => !ids.includes(id)))
    }
  }

  const toggleAccountInFilter = (accountId, mp, nextChecked) => {
    if (nextChecked) {
      setSelectedAccountIds((prev) => [...new Set([...prev, accountId])])
      setSelectedMarketplaces((prev) => [...new Set([...prev, mp])])
    } else {
      setSelectedAccountIds((prev) => prev.filter((id) => id !== accountId))
    }
  }

  const isMarketplaceGroupFullySelected = (mp) => {
    const group = accounts.filter((a) => marketplaceKey(a) === mp)
    return group.length > 0 && group.every((a) => selectedAccountIds.includes(a.id))
  }

  const loadIntegrations = async () => {
    try {
      const payload = await authFetch('/api/integrations', token)
      setIntegrations(payload)
    } catch (err) {
      setError(err.message)
    }
  }

  const loadAccounts = useCallback(async () => {
    try {
      const payload = await authFetch('/api/accounts', token)
      setAccounts(payload)
    } catch (err) {
      setError(err.message)
    }
  }, [token])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    if (!accounts.length) return

    const allIds = accounts.map((a) => a.id)
    const allMp = [...new Set(accounts.map((item) => marketplaceKey(item)))].filter(Boolean)
    const idSet = new Set(allIds)
    const prevIds = prevAccountIdsRef.current
    const addedAccountIds =
      prevIds == null ? allIds : allIds.filter((id) => !prevIds.has(id))
    prevAccountIdsRef.current = new Set(allIds)

    setSelectedAccountIds((sel) => {
      const base = sel.filter((id) => idSet.has(id))
      if (!sel.length && !base.length) return allIds
      return [...new Set([...base, ...addedAccountIds])]
    })

    setSelectedMarketplaces((mps) => {
      const seed = mps.length ? mps.filter((mp) => allMp.includes(mp)) : allMp
      const set = new Set(seed.length ? seed : allMp)
      for (const id of addedAccountIds) {
        const acc = accounts.find((a) => a.id === id)
        if (acc) set.add(marketplaceKey(acc))
      }
      return [...set].filter((mp) => allMp.includes(mp))
    })
  }, [accounts])

  useEffect(() => {
    if (!accounts.length) return

    const loadCabinetData = async () => {
      setIsLoading(true)
      setError('')

      try {
        const recommendationsByAccount = await Promise.all(
          accounts.map(async (account) => {
            try {
              const rows = await authFetch(`/api/recommendations?accountId=${account.id}`, token)
              return rows.map((item) => ({
                ...item,
                accountId: Number(item.accountId ?? account.id),
                marketplaceType: account.marketplaceType || account.marketplace,
                accountName: account.name,
              }))
            } catch {
              return []
            }
          }),
        )

        const [stocks, notificationsPayload, integrationsPayload, productsPayload] =
          await Promise.all([
            authFetch('/api/stocks/critical?days=5', token),
            authFetch('/api/notifications', token),
            authFetch('/api/integrations', token),
            authFetch('/api/products', token),
          ])

        setRecommendations(recommendationsByAccount.flat())
        setCriticalStocks(stocks.items || [])
        setNotifications(notificationsPayload)
        setIntegrations(integrationsPayload)
        setProducts(productsPayload || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadCabinetData()
  }, [accounts, token])

  useEffect(() => {
    if (!effectiveAccountId) return
    const loadForecastSettings = async () => {
      try {
        const forecastPayload = await authFetch(
          `/api/forecast/settings?accountId=${effectiveAccountId}`,
          token,
        )
        setForecastSettings(forecastPayload)
      } catch (err) {
        setError(err.message)
      }
    }
    loadForecastSettings()
  }, [effectiveAccountId, token])

  const runForecast = async () => {
    if (!effectiveAccountId) return
    setIsForecastLoading(true)
    setStatus('')
    setError('')

    try {
      const payload = await authFetch('/api/recommendations/generate', token, {
        method: 'POST',
        body: JSON.stringify({
          accountId: effectiveAccountId,
          forecastDays: forecastSettings.forecastDays,
        }),
      })
      const fresh = payload.items || []
      const acc = accounts.find((a) => Number(a.id) === Number(effectiveAccountId))
      const enriched = fresh.map((item) => ({
        ...item,
        accountId: Number(item.accountId ?? effectiveAccountId),
        marketplaceType: acc ? marketplaceKey(acc) : item.marketplaceType,
        accountName: acc?.name ?? item.accountName,
      }))
      setRecommendations((prev) => {
        const nextId = Number(effectiveAccountId)
        const rest = prev.filter((item) => Number(item.accountId) !== nextId)
        return [...rest, ...enriched]
      })
      setStatus('Рекомендации обновлены')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsForecastLoading(false)
    }
  }

  const saveForecastSettings = async (event) => {
    event.preventDefault()
    if (!effectiveAccountId) return

    try {
      const payload = await authFetch(
        `/api/forecast/settings?accountId=${effectiveAccountId}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify(forecastSettings),
        },
      )
      setForecastSettings(payload)
      setStatus('Настройки прогноза сохранены')
    } catch (err) {
      setError(err.message)
    }
  }

  const saveNotifications = async (event) => {
    event.preventDefault()
    try {
      const payload = await authFetch('/api/notifications/settings', token, {
        method: 'PATCH',
        body: JSON.stringify(notifications),
      })
      setNotifications(payload)
      setStatus('Настройки уведомлений сохранены')
    } catch (err) {
      setError(err.message)
    }
  }

  const cancelIntegrationEdit = () => {
    setEditingIntegrationId(null)
    setIntegrationForm({
      marketplace: 'wb',
      name: 'Новый кабинет',
      apiKey: '',
      clientId: '',
      externalBusinessId: '',
      externalCampaignId: '',
    })
    setError('')
  }

  const startEditIntegration = (item) => {
    setEditingIntegrationId(item.id)
    setIntegrationForm({
      marketplace: item.marketplace,
      name: item.name,
      apiKey: '',
      clientId: '',
      externalBusinessId: item.externalBusinessId ?? '',
      externalCampaignId: item.externalCampaignId ?? '',
    })
    setError('')
    setStatus('')
  }

  const submitIntegration = async (event) => {
    event.preventDefault()
    setIsIntegrationLoading(true)
    setError('')
    setStatus('')

    try {
      if (editingIntegrationId) {
        const body = { name: integrationForm.name.trim() }
        const cred = {}
        if (integrationForm.apiKey.trim()) cred.apiKey = integrationForm.apiKey.trim()
        if (integrationForm.marketplace === 'ozon' && integrationForm.clientId.trim()) {
          cred.clientId = integrationForm.clientId.trim()
        }
        if (Object.keys(cred).length) body.credentials = cred
        if (integrationForm.marketplace === 'yandex') {
          const extBiz = integrationForm.externalBusinessId.trim()
          const extCamp = integrationForm.externalCampaignId.trim()
          if (extBiz) body.externalBusinessId = extBiz
          if (extCamp) body.externalCampaignId = extCamp
        }

        await authFetch(`/api/integrations/${editingIntegrationId}`, token, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })

        setEditingIntegrationId(null)
        setIntegrationForm({
          marketplace: 'wb',
          name: 'Новый кабинет',
          apiKey: '',
          clientId: '',
          externalBusinessId: '',
          externalCampaignId: '',
        })
        await Promise.all([loadIntegrations(), loadAccounts()])
        setStatus('Интеграция обновлена')
      } else {
        const credentials =
          integrationForm.marketplace === 'ozon'
            ? { clientId: integrationForm.clientId, apiKey: integrationForm.apiKey }
            : { apiKey: integrationForm.apiKey }

        const connectBody = {
          marketplace: integrationForm.marketplace,
          name: integrationForm.name,
          credentials,
        }
        if (integrationForm.marketplace === 'yandex') {
          if (integrationForm.externalBusinessId.trim()) {
            connectBody.externalBusinessId = integrationForm.externalBusinessId.trim()
          }
          if (integrationForm.externalCampaignId.trim()) {
            connectBody.externalCampaignId = integrationForm.externalCampaignId.trim()
          }
        }

        await authFetch('/api/integrations/connect', token, {
          method: 'POST',
          body: JSON.stringify(connectBody),
        })

        setIntegrationForm((prev) => ({
          ...prev,
          apiKey: '',
          clientId: '',
          externalBusinessId: '',
          externalCampaignId: '',
        }))
        await Promise.all([loadIntegrations(), loadAccounts()])
        setStatus('Интеграция подключена')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsIntegrationLoading(false)
    }
  }

  const testIntegration = async (id) => {
    setError('')
    setStatus('')
    try {
      await authFetch(`/api/integrations/${id}/test`, token, { method: 'POST' })
      await loadIntegrations()
      setStatus('Проверка подключения успешна')
    } catch (err) {
      await loadIntegrations()
      setError(err.message)
    }
  }

  const syncIntegration = async (id) => {
    setError('')
    setStatus('')
    try {
      await authFetch(`/api/integrations/${id}/sync`, token, {
        method: 'POST',
        body: JSON.stringify({ entities: ['products', 'stocks', 'orders', 'sales', 'tariffs'] }),
      })
      await Promise.all([loadIntegrations(), loadAccounts()])
      setStatus('Синхронизация запущена')
    } catch (err) {
      await Promise.all([loadIntegrations(), loadAccounts()])
      setError(err.message)
    }
  }

  const selectedProductsCount = useMemo(
    () => products.filter((p) => activeAccountIds.includes(Number(p.accountId))).length,
    [products, activeAccountIds],
  )

  const urgentRecCount = useMemo(
    () =>
      dashboardRecommendations.filter(
        (r) =>
          Number(r.recommendedQuantity) > 0 && ['critical', 'high'].includes(String(r.priority)),
      ).length,
    [dashboardRecommendations],
  )

  const dashboardChecklistItems = useMemo(
    () => criticalRecommendations.slice(0, 8),
    [criticalRecommendations],
  )

  const pageHead = useMemo(() => {
    const map = {
      dashboard: {
        title: 'Дашборд',
        sub: 'Сводка по остаткам, рекомендациям и поставкам',
      },
      recommendations: {
        title: 'Рекомендации',
        sub: 'Прогноз пополнения по выбранным магазинам',
      },
      settings: {
        title: 'Настройки прогноза',
        sub: 'Горизонт и стратегия расчёта',
      },
      notifications: {
        title: 'Уведомления',
        sub: 'Telegram и email-алерты',
      },
      integrations: {
        title: 'Интеграции',
        sub: 'Маркетплейсы и синхронизация данных',
      },
    }
    return map[activePage] ?? map.dashboard
  }, [activePage])

  return (
    <div className="cabinet-page">
      <div className="cabinet-app">
        <aside className="cabinet-rail" aria-label="Разделы кабинета">
          <div className="cabinet-rail-brand" title="MaLogist">
            <span className="cabinet-rail-brand-mark">M</span>
          </div>
          <nav className="cabinet-rail-nav">
            {CABINET_RAIL_PAGES.map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                className={`cabinet-rail-btn ${activePage === id ? 'active' : ''}`}
                title={label}
                aria-label={label}
                aria-current={activePage === id ? 'page' : undefined}
                onClick={() => setActivePage(id)}
              >
                <span className="cabinet-rail-icon" aria-hidden>
                  {icon}
                </span>
              </button>
            ))}
          </nav>
          <div className="cabinet-rail-footer">
            <button
              type="button"
              className="cabinet-rail-btn"
              title="На главную сайта"
              aria-label="На главную сайта"
              onClick={onBack}
            >
              <span className="cabinet-rail-icon" aria-hidden>
                ⌂
              </span>
            </button>
            <button
              type="button"
              className="cabinet-rail-btn cabinet-rail-btn--muted"
              title="Выйти из аккаунта"
              aria-label="Выйти из аккаунта"
              onClick={onLogout}
            >
              <span className="cabinet-rail-icon" aria-hidden>
                →
              </span>
            </button>
          </div>
        </aside>

        <div className="cabinet-workspace">
          <header className="cabinet-header-bar">
            <div className="cabinet-header-welcome">
              <p className="cabinet-header-greet">
                Привет{user?.name ? `, ${user.name}` : ''}
              </p>
              <p className="cabinet-header-date">
                {new Date().toLocaleDateString('ru-RU', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="cabinet-header-actions">
              <span className="cabinet-user-chip" title={user?.email ?? ''}>
                <span className="cabinet-user-avatar" aria-hidden>
                  {(user?.email || '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="cabinet-user-email">{user?.email}</span>
              </span>
            </div>
          </header>

          <div className="cabinet-page-head">
            <h1 className="cabinet-page-title">{pageHead.title}</h1>
            <p className="cabinet-page-sub">{pageHead.sub}</p>
            {activePage === 'dashboard' ||
            activePage === 'recommendations' ||
            activePage === 'settings' ? (
              <p className="cabinet-page-hint">
                Магазины из интеграций подтягиваются после подключения и синхронизации. В «Источниках данных»
                выберите, какие кабинеты учитывать в сводке.
              </p>
            ) : null}
          </div>

          {activePage === 'dashboard' ||
          activePage === 'recommendations' ||
          activePage === 'settings' ? (
            <section className="cabinet-card cabinet-filters cabinet-filters--shell">
              <h3>Источники данных</h3>
              <p className="cabinet-filters-lead">
                Снимите маркетплейс или отдельный магазин, чтобы исключить его из сводки.
              </p>
              {!accounts.length ? (
                <p className="muted">Подключите интеграции, чтобы появились кабинеты.</p>
              ) : (
                <div className="cabinet-filter-groups">
                  {marketplaceOptions.map((mp) => {
                    const group = accounts.filter((a) => marketplaceKey(a) === mp)
                    const label = MARKETPLACE_LABELS[mp] || mp
                    return (
                      <div key={mp} className="cabinet-filter-group">
                        <label className="cabinet-filter-mp">
                          <input
                            ref={(el) => {
                              marketplaceCheckboxRefs.current[mp] = el
                            }}
                            type="checkbox"
                            checked={isMarketplaceGroupFullySelected(mp)}
                            onChange={(event) => toggleMarketplaceGroup(mp, event.target.checked)}
                          />
                          <span>{label}</span>
                        </label>
                        <ul className="cabinet-filter-stores">
                          {group.map((acc) => (
                            <li key={acc.id}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={selectedAccountIds.includes(acc.id)}
                                  onChange={(event) =>
                                    toggleAccountInFilter(acc.id, mp, event.target.checked)
                                  }
                                />
                                <span>{acc.name || `Магазин #${acc.id}`}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          ) : null}

          {activePage === 'dashboard' ? (
            <div className="cabinet-bento" aria-label="Виджеты дашборда">
              <div className="cabinet-bento-kpi cabinet-bento-card">
                <div className="cabinet-bento-kpi-grid">
                  <div className="cabinet-kpi-tile">
                    <span className="cabinet-kpi-label">Критичные артикулы</span>
                    <div className="cabinet-kpi-value-row">
                      <strong>{activeAccountIds.length ? criticalRecommendations.length : '—'}</strong>
                      <span className="cabinet-kpi-pill">приоритет</span>
                    </div>
                  </div>
                  <div className="cabinet-kpi-tile">
                    <span className="cabinet-kpi-label">Критичные остатки</span>
                    <div className="cabinet-kpi-value-row">
                      <strong>
                        {activeAccountIds.length ? dashboardCriticalStocks.length : '—'}
                      </strong>
                      <span className="cabinet-kpi-pill">склады</span>
                    </div>
                  </div>
                  <div className="cabinet-kpi-tile">
                    <span className="cabinet-kpi-label">Рекомендаций</span>
                    <div className="cabinet-kpi-value-row">
                      <strong>
                        {activeAccountIds.length ? dashboardRecommendations.length : '—'}
                      </strong>
                      <span className="cabinet-kpi-pill">всего</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="cabinet-bento-chart cabinet-bento-card">
                <div className="cabinet-bento-card-head">
                  <h2 className="cabinet-bento-card-title">Аналитика</h2>
                  <p className="cabinet-bento-card-desc">Вкладки переключают вид графика</p>
                </div>
                <DashboardCharts
                  variant="hero"
                  recommendations={dashboardRecommendations}
                  criticalStocks={dashboardCriticalStocks}
                  hasSelection={Boolean(activeAccountIds.length)}
                />
              </div>

              <div className="cabinet-bento-checklist cabinet-bento-card">
                <h2 className="cabinet-bento-card-title">Срочный фокус</h2>
                <p className="cabinet-bento-card-desc">Критичный и высокий приоритет</p>
                <ul className="cabinet-checklist">
                  {dashboardChecklistItems.length ? (
                    dashboardChecklistItems.map((item) => (
                      <li
                        key={`${item.accountId}-${item.productId}-${item.warehouseId}-${item.sku}`}
                        className="cabinet-checklist-row"
                      >
                        <span className={`cabinet-checklist-pri risk-note ${item.priority || 'safe'}`}>
                          {formatPriority(item.priority)}
                        </span>
                        <div className="cabinet-checklist-body">
                          <strong>{item.sku}</strong>
                          <span className="cabinet-checklist-meta">
                            {item.accountName || '—'} · {item.warehouse} ·{' '}
                            {Number(item.daysUntilStockout || 0).toFixed(0)} дн.
                          </span>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="cabinet-checklist-empty muted">
                      Нет позиций с критичным или высоким приоритетом
                    </li>
                  )}
                </ul>
              </div>

              <div className="cabinet-bento-promo cabinet-bento-card cabinet-bento-promo--accent">
                <h3 className="cabinet-bento-card-title">Маркетплейсы</h3>
                <p className="cabinet-bento-promo-text">
                  Подключите интеграцию — подтянем товары, остатки и заказы в этот дашборд.
                </p>
                <button
                  type="button"
                  className="button button-solid"
                  onClick={() => setActivePage('integrations')}
                >
                  К интеграциям
                </button>
              </div>

              <div className="cabinet-bento-stats cabinet-bento-card">
                <h3 className="cabinet-bento-card-title">Каталог</h3>
                <ul className="cabinet-mini-stats">
                  <li>
                    <span>Товаров в выборке</span>
                    <strong>{selectedProductsCount}</strong>
                  </li>
                  <li>
                    <span>Магазинов в фильтре</span>
                    <strong>{activeAccountIds.length}</strong>
                  </li>
                  <li>
                    <span>Интеграций</span>
                    <strong>{integrations.length}</strong>
                  </li>
                </ul>
              </div>

              <div className="cabinet-bento-detail cabinet-bento-card">
                <h3 className="cabinet-bento-card-title">Поставки</h3>
                <ul className="cabinet-mini-stats">
                  <li>
                    <span>Срочных к отгрузке</span>
                    <strong>{urgentRecCount}</strong>
                  </li>
                  <li>
                    <span>Рекомендаций в сводке</span>
                    <strong>
                      {activeAccountIds.length ? dashboardRecommendations.length : '—'}
                    </strong>
                  </li>
                </ul>
              </div>

              <section className="cabinet-bento-table cabinet-bento-card">
                <h3>Критичные остатки</h3>
                {isLoading ? (
                  <p>Загружаем данные...</p>
                ) : !activeAccountIds.length ? (
                  <p>Выберите хотя бы один магазин в фильтре выше.</p>
                ) : (
                  <>
                    <div className="cabinet-table-toolbar">
                      <label className="cabinet-table-search">
                        <span className="sr-only">Поиск по таблице</span>
                        <input
                          type="search"
                          placeholder="Поиск: маркетплейс, магазин, SKU, склад…"
                          value={dashStockQuery}
                          onChange={(event) => setDashStockQuery(event.target.value)}
                          autoComplete="off"
                        />
                      </label>
                      <button
                        type="button"
                        className="button button-outline button-compact"
                        disabled={!processedDashStocks.length}
                        onClick={exportDashStocksCsv}
                      >
                        Экспорт CSV
                      </button>
                    </div>
                    <div className="table-wrap">
                      <table className="cabinet-data-table">
                        <thead>
                          <tr>
                            <SortableTh
                              label="Маркетплейс"
                              sortKey="marketplace"
                              sort={dashStockSort}
                              onToggle={toggleDashStockSort}
                            />
                            <SortableTh
                              label="Магазин"
                              sortKey="account"
                              sort={dashStockSort}
                              onToggle={toggleDashStockSort}
                            />
                            <SortableTh
                              label="Артикул"
                              sortKey="sku"
                              sort={dashStockSort}
                              onToggle={toggleDashStockSort}
                            />
                            <SortableTh
                              label="Склад"
                              sortKey="warehouse"
                              sort={dashStockSort}
                              onToggle={toggleDashStockSort}
                            />
                            <SortableTh
                              label="Остаток"
                              sortKey="stock"
                              sort={dashStockSort}
                              onToggle={toggleDashStockSort}
                            />
                            <SortableTh
                              label="Дней запаса"
                              sortKey="daysUntilStockout"
                              sort={dashStockSort}
                              onToggle={toggleDashStockSort}
                            />
                          </tr>
                        </thead>
                        <tbody>
                          {dashStockPageData.slice.length ? (
                            dashStockPageData.slice.map((item) => {
                              const severity = getSeverityByDays(item.daysUntilStockout || 999)
                              const accId = productAccountById.get(item.productId)
                              const acc = accId != null ? accountById.get(accId) : null
                              const mp = acc ? marketplaceKey(acc) : ''
                              const mpHuman = MARKETPLACE_LABELS[mp] || mp || '—'
                              return (
                                <tr
                                  key={`${item.productId}-${item.warehouseId ?? item.warehouse}-${accId}`}
                                >
                                  <td>{mpHuman}</td>
                                  <td>{acc?.name ?? '—'}</td>
                                  <td>{item.sku}</td>
                                  <td>{item.warehouse}</td>
                                  <td>
                                    <span className={`risk-value ${severity}`}>{item.stock}</span>
                                  </td>
                                  <td>
                                    <span className={`risk-value ${severity}`}>
                                      {item.daysUntilStockout}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })
                          ) : (
                            <tr>
                              <td colSpan="6" className="empty-table">
                                {dashboardCriticalStocks.length
                                  ? 'Нет строк по фильтру поиска'
                                  : 'Критичных остатков нет'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {dashStockPageData.total > 0 ? (
                      <div className="cabinet-table-pagination">
                        <span className="cabinet-table-pagination-meta">
                          {(dashStockPageData.page - 1) * TABLE_PAGE_SIZE + 1}–
                          {Math.min(
                            dashStockPageData.page * TABLE_PAGE_SIZE,
                            dashStockPageData.total,
                          )}{' '}
                          из {dashStockPageData.total}
                        </span>
                        <div className="cabinet-table-pagination-actions">
                          <button
                            type="button"
                            className="button button-outline button-compact"
                            disabled={dashStockPageData.page <= 1}
                            onClick={() => setDashStockPage((p) => Math.max(1, p - 1))}
                          >
                            Назад
                          </button>
                          <button
                            type="button"
                            className="button button-outline button-compact"
                            disabled={dashStockPageData.page >= dashStockPageData.pages}
                            onClick={() =>
                              setDashStockPage((p) =>
                                Math.min(dashStockPageData.pages, p + 1),
                              )
                            }
                          >
                            Вперёд
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            </div>
          ) : null}

          {activePage === 'recommendations' ? (
            <section className="cabinet-card">
              <div className="cabinet-row cabinet-row-recommendations">
                <div>
                  <h3>Рекомендации</h3>
                  {effectiveAccountId ? (
                    <p className="cabinet-inline-hint">
                      Пересчёт прогноза — для «
                      {accountById.get(effectiveAccountId)?.name ?? 'магазин'}» (первый среди отмеченных
                      выше).
                    </p>
                  ) : (
                    <p className="cabinet-inline-hint">
                      Отметьте магазины в «Источники данных», чтобы запустить пересчёт.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="button button-solid"
                  onClick={runForecast}
                  disabled={isForecastLoading || !effectiveAccountId}
                >
                  {isForecastLoading ? 'Считаем...' : 'Спрогнозировать поставки'}
                </button>
              </div>

              {isLoading ? (
                <p>Загружаем данные...</p>
              ) : (
                <>
                  <div className="cabinet-table-toolbar">
                    <label className="cabinet-table-search">
                      <span className="sr-only">Поиск по таблице</span>
                      <input
                        type="search"
                        placeholder="Поиск: маркетплейс, магазин, SKU, приоритет…"
                        value={recQuery}
                        onChange={(event) => setRecQuery(event.target.value)}
                        autoComplete="off"
                      />
                    </label>
                    <button
                      type="button"
                      className="button button-outline button-compact"
                      disabled={!processedRecommendations.length}
                      onClick={exportRecommendationsCsv}
                    >
                      Экспорт CSV
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table className="cabinet-data-table">
                      <thead>
                        <tr>
                          <SortableTh
                            label="Маркетплейс"
                            sortKey="marketplace"
                            sort={recSort}
                            onToggle={toggleRecSort}
                          />
                          <SortableTh
                            label="Магазин"
                            sortKey="account"
                            sort={recSort}
                            onToggle={toggleRecSort}
                          />
                          <SortableTh
                            label="Артикул"
                            sortKey="sku"
                            sort={recSort}
                            onToggle={toggleRecSort}
                          />
                          <SortableTh
                            label="Склад"
                            sortKey="warehouse"
                            sort={recSort}
                            onToggle={toggleRecSort}
                          />
                          <SortableTh
                            label="Остаток"
                            sortKey="currentStock"
                            sort={recSort}
                            onToggle={toggleRecSort}
                          />
                          <SortableTh
                            label="Дней запаса"
                            sortKey="daysUntilStockout"
                            sort={recSort}
                            onToggle={toggleRecSort}
                          />
                          <SortableTh
                            label="К поставке"
                            sortKey="recommendedQuantity"
                            sort={recSort}
                            onToggle={toggleRecSort}
                          />
                          <SortableTh
                            label="Приоритет"
                            sortKey="priority"
                            sort={recSort}
                            onToggle={toggleRecSort}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {!activeAccountIds.length ? (
                          <tr>
                            <td colSpan="8" className="empty-table">
                              Выберите хотя бы один магазин в фильтре выше.
                            </td>
                          </tr>
                        ) : recPageData.slice.length ? (
                          recPageData.slice.map((item) => {
                            const severity = getSeverityByDays(item.daysUntilStockout || 999)
                            const mp = item.marketplaceType || ''
                            const mpHuman = MARKETPLACE_LABELS[mp] || mp || '—'
                            return (
                              <tr
                                key={`${item.accountId}-${item.productId}-${item.warehouseId}-${item.createdAt}`}
                              >
                                <td>{mpHuman}</td>
                                <td>{item.accountName || '—'}</td>
                                <td>{item.sku}</td>
                                <td>{item.warehouse}</td>
                                <td>
                                  <span className={`risk-value ${severity}`}>
                                    {numberFormatter.format(item.currentStock)}
                                  </span>
                                </td>
                                <td>
                                  <span className={`risk-value ${severity}`}>
                                    {Number(item.daysUntilStockout || 0).toFixed(1)}
                                  </span>
                                </td>
                                <td className={item.recommendedQuantity > 0 ? 'plus' : 'muted'}>
                                  {item.recommendedQuantity > 0
                                    ? `+${numberFormatter.format(item.recommendedQuantity)}`
                                    : '0'}
                                </td>
                                <td>
                                  <span className={`risk-note ${item.priority || 'safe'}`}>
                                    {formatPriority(item.priority)}
                                  </span>
                                </td>
                              </tr>
                            )
                          })
                        ) : (
                          <tr>
                            <td colSpan="8" className="empty-table">
                              {filteredRecommendations.length
                                ? 'Нет строк по фильтру поиска'
                                : 'Нет рекомендаций для выбранных магазинов'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {activeAccountIds.length && recPageData.total > 0 ? (
                    <div className="cabinet-table-pagination">
                      <span className="cabinet-table-pagination-meta">
                        {(recPageData.page - 1) * TABLE_PAGE_SIZE + 1}–
                        {Math.min(recPageData.page * TABLE_PAGE_SIZE, recPageData.total)} из{' '}
                        {recPageData.total}
                      </span>
                      <div className="cabinet-table-pagination-actions">
                        <button
                          type="button"
                          className="button button-outline button-compact"
                          disabled={recPageData.page <= 1}
                          onClick={() => setRecPage((p) => Math.max(1, p - 1))}
                        >
                          Назад
                        </button>
                        <button
                          type="button"
                          className="button button-outline button-compact"
                          disabled={recPageData.page >= recPageData.pages}
                          onClick={() => setRecPage((p) => Math.min(recPageData.pages, p + 1))}
                        >
                          Вперёд
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          ) : null}

          {activePage === 'settings' ? (
            <form className="cabinet-card" onSubmit={saveForecastSettings}>
              <h3>Настройки прогноза</h3>
              {effectiveAccountId ? (
                <p className="cabinet-filters-lead">
                  Сохраняются для «{accountById.get(effectiveAccountId)?.name ?? 'магазин'}» — это первый
                  магазин среди отмеченных в «Источники данных» (порядок как в списке кабинетов).
                </p>
              ) : (
                <p className="cabinet-filters-lead">
                  Отметьте хотя бы один магазин в «Источники данных».
                </p>
              )}
              <label>
                Горизонт прогноза
                <input
                  type="number"
                  min="7"
                  max="60"
                  value={forecastSettings.forecastDays ?? 28}
                  disabled={!effectiveAccountId}
                  onChange={(event) =>
                    setForecastSettings((prev) => ({
                      ...prev,
                      forecastDays: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Страховой запас, дней
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={forecastSettings.safetyStockDays ?? 5}
                  disabled={!effectiveAccountId}
                  onChange={(event) =>
                    setForecastSettings((prev) => ({
                      ...prev,
                      safetyStockDays: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Стратегия
                <select
                  value={forecastSettings.strategy ?? 'balanced'}
                  disabled={!effectiveAccountId}
                  onChange={(event) =>
                    setForecastSettings((prev) => ({
                      ...prev,
                      strategy: event.target.value,
                    }))
                  }
                >
                  <option value="balanced">Баланс скорости и маржи</option>
                  <option value="speed">Скорость доставки</option>
                  <option value="margin">Маржа</option>
                </select>
              </label>
              <button
                type="submit"
                className="button button-solid"
                disabled={!effectiveAccountId}
              >
                Сохранить прогноз
              </button>
            </form>
          ) : null}

          {activePage === 'notifications' ? (
            <form className="cabinet-card" onSubmit={saveNotifications}>
              <h3>Уведомления</h3>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={Boolean(notifications.telegramEnabled)}
                  onChange={(event) =>
                    setNotifications((prev) => ({
                      ...prev,
                      telegramEnabled: event.target.checked,
                    }))
                  }
                />
                Telegram
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={Boolean(notifications.emailEnabled)}
                  onChange={(event) =>
                    setNotifications((prev) => ({
                      ...prev,
                      emailEnabled: event.target.checked,
                    }))
                  }
                />
                Эл. почта
              </label>
              <label>
                Алерт за N дней
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={notifications.stockoutAlertDays ?? 5}
                  onChange={(event) =>
                    setNotifications((prev) => ({
                      ...prev,
                      stockoutAlertDays: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <button type="submit" className="button button-solid">
                Сохранить уведомления
              </button>
            </form>
          ) : null}

          {activePage === 'integrations' ? (
            <section className="cabinet-grid cabinet-grid--integrations">
              <form className="cabinet-card" onSubmit={submitIntegration}>
                <h3>{editingIntegrationId ? 'Редактировать интеграцию' : 'Подключить интеграцию'}</h3>
                {integrationForm.marketplace === 'ozon' && !editingIntegrationId ? (
                  <p className="cabinet-env-hint">
                    Ключи из файла <code className="inline-code">frontend/.env</code> подхватываются только
                    с именами <code className="inline-code">VITE_OZON_API_KEY</code> и{' '}
                    <code className="inline-code">VITE_OZON_CLIENT_ID</code> — после изменения .env перезапустите{' '}
                    <code className="inline-code">npm run dev</code>. Обычные{' '}
                    <code className="inline-code">OZON_*</code> в Vite в браузер не попадают.
                  </p>
                ) : null}
                {editingIntegrationId ? (
                  <p className="cabinet-env-hint">
                    Площадку нельзя сменить у существующей записи. Поля ключей можно оставить пустыми — тогда
                    сохранятся текущие значения.
                  </p>
                ) : (
                  <p className="cabinet-env-hint">
                    <strong>Несколько магазинов.</strong> У Wildberries и Ozon один API‑токен обычно соответствует
                    одному кабинету продавца: чтобы подключить несколько магазинов, добавьте отдельную интеграцию
                    для каждого (свой ключ WB, свой пара Client ID + ключ Ozon). На дашборде и в рекомендациях
                    включайте и выключайте магазины в «Источниках данных». Для Яндекс Маркета при нескольких
                    кампаниях укажите нужные идентификаторы ниже (если используете).
                  </p>
                )}
                <label>
                  Маркетплейс
                  <select
                    value={integrationForm.marketplace}
                    disabled={Boolean(editingIntegrationId)}
                    onChange={(event) => {
                      const marketplace = event.target.value
                      setIntegrationForm((prev) => {
                        if (marketplace !== 'ozon') {
                          return { ...prev, marketplace }
                        }
                        const d = devOzonDefaults()
                        return {
                          ...prev,
                          marketplace,
                          apiKey: prev.apiKey.trim() ? prev.apiKey : d.apiKey,
                          clientId: prev.clientId.trim() ? prev.clientId : d.clientId,
                        }
                      })
                    }}
                  >
                    <option value="wb">Wildberries</option>
                    <option value="ozon">Ozon</option>
                    <option value="yandex">Яндекс Маркет</option>
                  </select>
                </label>
                <label>
                  Название
                  <input
                    value={integrationForm.name}
                    onChange={(event) =>
                      setIntegrationForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  Ключ API
                  <input
                    value={integrationForm.apiKey}
                    onChange={(event) =>
                      setIntegrationForm((prev) => ({ ...prev, apiKey: event.target.value }))
                    }
                    placeholder={editingIntegrationId ? 'Не менять' : ''}
                    required={!editingIntegrationId}
                  />
                </label>
                {integrationForm.marketplace === 'ozon' ? (
                  <label>
                    ID клиента (Ozon)
                    <input
                      value={integrationForm.clientId}
                      onChange={(event) =>
                        setIntegrationForm((prev) => ({ ...prev, clientId: event.target.value }))
                      }
                      placeholder={editingIntegrationId ? 'Не менять' : ''}
                      required={!editingIntegrationId}
                    />
                  </label>
                ) : null}
                {integrationForm.marketplace === 'yandex' ? (
                  <>
                    <label>
                      ID бизнеса / кабинета (если нужно API)
                      <input
                        value={integrationForm.externalBusinessId}
                        onChange={(event) =>
                          setIntegrationForm((prev) => ({
                            ...prev,
                            externalBusinessId: event.target.value,
                          }))
                        }
                        placeholder="Необязательно"
                      />
                    </label>
                    <label>
                      ID кампании (если нужно API)
                      <input
                        value={integrationForm.externalCampaignId}
                        onChange={(event) =>
                          setIntegrationForm((prev) => ({
                            ...prev,
                            externalCampaignId: event.target.value,
                          }))
                        }
                        placeholder="Необязательно"
                      />
                    </label>
                  </>
                ) : null}
                <div className="integration-form-actions">
                  <button type="submit" className="button button-solid" disabled={isIntegrationLoading}>
                    {isIntegrationLoading
                      ? editingIntegrationId
                        ? 'Сохраняем...'
                        : 'Подключаем...'
                      : editingIntegrationId
                        ? 'Сохранить'
                        : 'Подключить'}
                  </button>
                  {editingIntegrationId ? (
                    <button
                      type="button"
                      className="button button-outline"
                      disabled={isIntegrationLoading}
                      onClick={cancelIntegrationEdit}
                    >
                      Отмена
                    </button>
                  ) : null}
                </div>
              </form>

              <article className="cabinet-card">
                <h3>Список интеграций</h3>
                <div className="table-wrap">
                  <table className="integrations-table">
                    <thead>
                      <tr>
                        <th>Площадка</th>
                        <th>Название</th>
                        <th>Статус</th>
                        <th>Последняя синхронизация</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {integrations.length ? (
                        integrations.map((item) => (
                          <tr key={item.id}>
                            <td>
                              {MARKETPLACE_LABELS[item.marketplace] || item.marketplace}
                            </td>
                            <td className="integrations-table__name">{item.name}</td>
                            <td>
                              <span className={`risk-note ${item.status || 'safe'}`}>
                                {formatIntegrationStatus(item.status)}
                              </span>
                            </td>
                            <td>{item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleString('ru-RU') : '—'}</td>
                            <td>
                              <div className="integration-actions">
                                <button
                                  type="button"
                                  className="button button-outline button-compact"
                                  onClick={() => startEditIntegration(item)}
                                >
                                  Изменить
                                </button>
                                <button
                                  type="button"
                                  className="button button-outline button-compact"
                                  onClick={() => testIntegration(item.id)}
                                >
                                  Проверить
                                </button>
                                <button
                                  type="button"
                                  className="button button-solid button-compact"
                                  onClick={() => syncIntegration(item.id)}
                                >
                                  Синхронизировать
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="empty-table">
                            Интеграции пока не подключены
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          ) : null}

          {status ? <p className="status-line">{status}</p> : null}
          {error ? <p className="api-error">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}

function LandingView({
  data,
  apiError,
  horizonDays,
  setHorizonDays,
  selectedSkus,
  toggleSkuFilter,
  skuOptions,
  activeRecommendations,
  generatePlan,
  isPlanLoading,
  downloadPlanCsv,
  isCsvLoading,
  csvStatus,
  planResult,
  criticalThreshold,
  setCriticalThreshold,
  isCriticalLoading,
  criticalSkus,
  isTelegramLoading,
  sendTelegramTest,
  telegramStatus,
  openCabinet,
}) {
  const [billing, setBilling] = useState('monthly')
  const pricingPlans = data.pricingPlans ?? fallbackData.pricingPlans

  const regionsByDemand = useMemo(() => {
    const list = data.regions?.length ? data.regions : fallbackData.regions
    return [...list].sort((a, b) => b.share - a.share)
  }, [data.regions])

  const formatPlanPrice = (plan) => {
    if (plan.monthly === null) return 'По запросу'
    const value = billing === 'monthly' ? plan.monthly : plan.annual
    return `${numberFormatter.format(value)} ₽`
  }

  const formatPlanPeriod = (plan) => {
    if (plan.monthly === null) return 'индивидуально'
    return billing === 'monthly' ? '/мес' : '/мес (при оплате за год)'
  }

  return (
    <div className="page">
      <header className="site-header">
        <a href="#" className="brand" aria-label="MaLogist">
          MaLogist
        </a>
        <nav className="header-nav">
          <a href="#how">Как это работает</a>
          <a href="#pricing">Тарифы</a>
          <a href="#operations">Операции</a>
          <a href="#recommendations">Рекомендации</a>
          <a href="#economics">Экономика</a>
        </nav>
        <button type="button" className="button button-ghost" onClick={openCabinet}>
          Личный кабинет
        </button>
      </header>

      <main>
        <section className="hero">
          <div className="hero-scene" aria-hidden="true">
            <img src="/hero/courier-scene.png" alt="" loading="lazy" />
          </div>

          <div className="hero-text" data-reveal>
            <p className="eyebrow">{data.hero.eyebrow}</p>
            <h1>{data.hero.title}</h1>
            <p className="lead">{data.hero.subtitle}</p>
            <div className="hero-actions">
              <button type="button" className="button button-solid" onClick={openCabinet}>
                {data.hero.ctaPrimary}
              </button>
              <a href="#recommendations" className="button button-outline">
                {data.hero.ctaSecondary}
              </a>
            </div>
            <p className="trust">{data.hero.trust}</p>
          </div>

          <div className="hero-stream" data-reveal>
            <h2>Что сделать сейчас</h2>
            <ul>
              {data.smartActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
            <div className="market-tags" aria-label="Поддерживаемые маркетплейсы">
              <div className="market-bubble bubble-wb" title="Wildberries">
                <img src="/marketplaces/wb.png" alt="Wildberries" loading="lazy" />
              </div>
              <div className="market-bubble bubble-ozon" title="Ozon">
                <img src="/marketplaces/ozon.png" alt="Ozon" loading="lazy" />
              </div>
              <div className="market-bubble bubble-ya" title="Яндекс Маркет">
                <img src="/marketplaces/ya-market.svg" alt="Яндекс Маркет" loading="lazy" />
              </div>
            </div>
          </div>
        </section>

        <section className="section pain" data-reveal>
          <p className="section-kicker">Проблема</p>
          <h2>Ты уже теряешь деньги, даже если не видишь этого</h2>
          <ul>
            {data.painPoints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section id="how" className="section flow" data-reveal>
          <p className="section-kicker">Как это работает</p>
          <h2>Нажал одну кнопку и получил план поставок</h2>
          <ol>
            {data.steps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className="section core" data-reveal>
          <p className="section-kicker">Ядро продукта</p>
          <h2>Мы не просто показываем цифры. Мы говорим, что делать.</h2>
          <p>Это не аналитика ради отчета. Это управление поставками в один клик.</p>
        </section>

        <section className="section map-section demand-section" data-reveal>
          <p className="section-kicker">Пульс спроса</p>
          <h2>Видишь, где реально покупают</h2>
          <p className="demand-section-lead">
            Живая схема без карты: крупные «горячие» узлы — там больше всего заказов и товара в
            обороте; слабый пульс — мало покупок и остатки почти не двигаются.
          </p>
          <div className="demand-flow" aria-label="Спрос по городам, анимация для наглядности">
            <div className="demand-flow-bg" aria-hidden />
            <div className="demand-flow-nodes">
              {regionsByDemand.map((region, i) => (
                <div
                  key={region.city}
                  className={`demand-node demand-node--${region.demand}`}
                  style={{ '--share': region.share, '--i': i }}
                >
                  <div className="demand-node-orb" aria-hidden />
                  <div className="demand-node-body">
                    <strong>{region.city}</strong>
                    <span className="demand-node-share">{region.share}% спроса</span>
                    <span className="demand-node-hint">
                      {DEMAND_NODE_HINTS[region.demand] ?? `Доля спроса ${region.share}%`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="map-legend demand-legend" aria-label="Легенда">
              <span className="legend-item high">Много покупок · товар в движении</span>
              <span className="legend-item medium">Средний уровень</span>
              <span className="legend-item low">Мало покупок · товар «застыл»</span>
            </div>
          </div>
        </section>

        <section className="section stock" data-reveal>
          <p className="section-kicker">Контроль остатков</p>
          <h2>Товар больше не заканчивается внезапно</h2>
          <ul>
            {data.stockAlerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        </section>

        <section id="operations" className="section operations" data-reveal>
          <p className="section-kicker">Операционный контур</p>
          <h2>Действия на день: критичные SKU, экспорт плана и Telegram</h2>
          <div className="ops-grid">
            <article className="ops-card">
              <div className="ops-head">
                <h3>Критичные SKU</h3>
                <div className="threshold-switch">
                  {[3, 5, 7].map((days) => (
                    <button
                      type="button"
                      key={days}
                      className={criticalThreshold === days ? 'active' : ''}
                      onClick={() => setCriticalThreshold(days)}
                    >
                      {days} дн
                    </button>
                  ))}
                </div>
              </div>

              {isCriticalLoading ? (
                <p>Загружаем критичные SKU...</p>
              ) : criticalSkus.length ? (
                <ul className="critical-list">
                  {criticalSkus.map((item) => (
                    <li key={`${item.sku}-${item.warehouse}-${item.daysLeft}`}>
                      <span className={`risk-badge ${item.riskLevel}`}>
                        {item.riskLevel === 'critical' ? 'Критично' : 'Риск'}
                      </span>
                      <strong>{item.sku}</strong>
                      <span>{item.warehouse}</span>
                      <span>Осталось {item.daysLeft} дн</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>На выбранном пороге критичных SKU нет.</p>
              )}
            </article>

            <article className="ops-card">
              <h3>Уведомления</h3>
              <p>Отправь тестовый alert в Telegram, чтобы проверить канал.</p>
              <button
                type="button"
                className="button button-outline"
                onClick={sendTelegramTest}
                disabled={isTelegramLoading}
              >
                {isTelegramLoading ? 'Отправляем...' : 'Тест Telegram-уведомления'}
              </button>
              {telegramStatus ? <p className="status-line">{telegramStatus}</p> : null}
            </article>
          </div>
        </section>

        <section id="economics" className="section economics" data-reveal>
          <p className="section-kicker">Экономия на логистике</p>
          <h2>Платишь меньше за логистику и не теряешь скорость доставки</h2>
          <div className="factor-line">
            {data.logisticsFactors.map((factor) => (
              <span key={factor}>{factor}</span>
            ))}
          </div>
          <div className="metrics">
            {data.economics.map((metric) => (
              <div key={metric.label}>
                <p className="metric-label">{metric.label}</p>
                <p className="metric-value">
                  <span className="count-up" data-target={metric.value}>
                    0
                  </span>
                  {metric.suffix}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="recommendations" className="section recommendations" data-reveal>
          <p className="section-kicker">Прогноз поставок</p>
          <h2>Планируй на 14, 28 или 30 дней вперед</h2>
          <div className="horizon-switch">
            {data.forecastHorizonDays.map((days) => (
              <button
                type="button"
                key={days}
                className={days === horizonDays ? 'active' : ''}
                onClick={() => setHorizonDays(days)}
              >
                {days} дней
              </button>
            ))}
          </div>

          <div className="sku-filter" aria-label="Фильтр по SKU">
            {skuOptions.map((sku) => (
              <button
                key={sku}
                type="button"
                className={`sku-chip ${selectedSkus.includes(sku) ? 'active' : ''}`}
                onClick={() => toggleSkuFilter(sku)}
              >
                {sku}
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Склад</th>
                  <th>Остаток</th>
                  <th>Дней хватит</th>
                  <th>Рекомендация</th>
                  <th>Примечание</th>
                </tr>
              </thead>
              <tbody>
                {activeRecommendations.length ? (
                  activeRecommendations.map((item) => {
                    const severity = getSeverityByDays(item.daysLeft)
                    const note = getRecommendationNote(item)
                    return (
                      <tr key={`${item.sku}-${item.warehouse}`}>
                        <td>{item.sku}</td>
                        <td>{item.warehouse}</td>
                        <td>
                          <span className={`risk-value ${severity}`}>
                            {numberFormatter.format(item.stock)}
                          </span>
                        </td>
                        <td>
                          <span className={`risk-value ${severity}`}>{item.daysLeft}</span>
                        </td>
                        <td className={item.recommendation > 0 ? 'plus' : 'muted'}>
                          {item.recommendation > 0 ? `+${item.recommendation}` : '0'}
                        </td>
                        <td>
                          <span className={`risk-note ${severity}`}>{note}</span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="empty-table">
                      Выберите минимум один SKU
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="recommendation-actions">
            <button
              type="button"
              className="button button-solid"
              onClick={generatePlan}
              disabled={isPlanLoading}
            >
              {isPlanLoading ? 'Считаем...' : 'Сформировать поставку'}
            </button>
            <button
              type="button"
              className="button button-outline"
              onClick={downloadPlanCsv}
              disabled={isCsvLoading}
            >
              {isCsvLoading ? 'Готовим...' : 'Экспорт в CSV'}
            </button>
          </div>

          {csvStatus ? <p className="status-line">{csvStatus}</p> : null}

          {planResult ? (
            <div className="plan-result">
              <p>
                План на {planResult.horizonDays} дней: отправить{' '}
                <strong>{numberFormatter.format(planResult.summary.totalUnits)} шт</strong> на{' '}
                <strong>{planResult.summary.warehousesInPlan}</strong> склад(а).
              </p>
              <p>
                Срочных SKU: <strong>{planResult.summary.urgentSkus}</strong>
              </p>
            </div>
          ) : null}
        </section>

        <section className="section audience" data-reveal>
          <p className="section-kicker">Для кого</p>
          <h2>Подходит селлерам, которые растут и не хотят хаоса</h2>
          <ul>
            {data.audience.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section id="pricing" className="section pricing-section" data-reveal>
          <p className="section-kicker">Тарифы</p>
          <h2>Плати за масштаб, а не за скрытые функции</h2>
          <p>Чем больше SKU и сложнее логистика, тем выше тариф. Базовая ценность доступна сразу.</p>

          <div className="billing-switch">
            <button
              type="button"
              className={billing === 'monthly' ? 'active' : ''}
              onClick={() => setBilling('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={billing === 'annual' ? 'active' : ''}
              onClick={() => setBilling('annual')}
            >
              Annual
            </button>
            <span>7 дней бесплатно</span>
          </div>

          <div className="pricing-grid">
            {pricingPlans.map((plan) => (
              <article
                key={plan.name}
                className={`pricing-card ${plan.featured ? 'featured' : ''}`}
              >
                <p className="plan-tag">{plan.tag}</p>
                <h3>{plan.name}</h3>
                <p className="plan-desc">{plan.description}</p>
                <p className="plan-price">
                  {formatPlanPrice(plan)} <small>{formatPlanPeriod(plan)}</small>
                </p>
                <p className="plan-sku">{plan.skuLimit}</p>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <button type="button" className="button button-outline" onClick={openCabinet}>
                  Выбрать
                </button>
              </article>
            ))}
          </div>

          <div className="pricing-foot">
            <p>
              Триггер входа: <strong>«Покажем ваши потери за 1 минуту»</strong>. Если сервис не окупается,
              вернем деньги.
            </p>
          </div>
        </section>

        <section id="cta" className="section cta" data-reveal>
          <h2>Попробуй и посмотри свои цифры</h2>
          <p>Первые 7 дней бесплатно</p>
          <div className="hero-actions">
            <button type="button" className="button button-solid" onClick={openCabinet}>
              Личный кабинет
            </button>
            <button type="button" className="button button-outline">
              Получить прогноз поставок
            </button>
          </div>
          {apiError ? <p className="api-error">{apiError}</p> : null}
        </section>
      </main>
    </div>
  )
}

function App() {
  const [view, setView] = useState('landing')
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('malogist_token') || '')
  const [authUser, setAuthUser] = useState(() => {
    const raw = localStorage.getItem('malogist_user')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })

  const [data, setData] = useState(fallbackData)
  const [apiError, setApiError] = useState('')
  const [horizonDays, setHorizonDays] = useState(28)
  const [planResult, setPlanResult] = useState(null)
  const [isPlanLoading, setIsPlanLoading] = useState(false)
  const [criticalThreshold, setCriticalThreshold] = useState(5)
  const [criticalSkus, setCriticalSkus] = useState([])
  const [isCriticalLoading, setIsCriticalLoading] = useState(false)
  const [selectedSkus, setSelectedSkus] = useState([])
  const [isCsvLoading, setIsCsvLoading] = useState(false)
  const [csvStatus, setCsvStatus] = useState('')
  const [isTelegramLoading, setIsTelegramLoading] = useState(false)
  const [telegramStatus, setTelegramStatus] = useState('')

  const openCabinet = () => {
    setView(authToken ? 'cabinet' : 'login')
  }

  const handleLoginSuccess = (payload) => {
    setAuthToken(payload.token)
    setAuthUser(payload.user)
    localStorage.setItem('malogist_token', payload.token)
    localStorage.setItem('malogist_user', JSON.stringify(payload.user))
    setView('cabinet')
  }

  const handleLogout = () => {
    localStorage.removeItem('malogist_token')
    localStorage.removeItem('malogist_user')
    setAuthToken('')
    setAuthUser(null)
    setView('landing')
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/landing-data')
        if (!response.ok) {
          throw new Error('API is unavailable')
        }
        const payload = await response.json()
        setData(payload)
      } catch {
        setApiError('API недоступен, показываем демо-данные.')
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    const revealNodes = document.querySelectorAll('[data-reveal]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 },
    )

    revealNodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [data])

  useEffect(() => {
    const counters = document.querySelectorAll('.count-up')
    const animationDuration = 1000

    const startCounter = (node) => {
      const target = Number(node.dataset.target ?? 0)
      const startTime = performance.now()

      const animate = (timestamp) => {
        const elapsed = timestamp - startTime
        const progress = Math.min(elapsed / animationDuration, 1)
        const value = Math.round(target * progress)
        node.textContent = numberFormatter.format(value)
        if (progress < 1) requestAnimationFrame(animate)
      }

      requestAnimationFrame(animate)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            startCounter(entry.target)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.3 },
    )

    counters.forEach((counter) => observer.observe(counter))
    return () => observer.disconnect()
  }, [data.economics])

  useEffect(() => {
    const allSkus = [...new Set(data.recommendations.map((item) => item.sku))]
    setSelectedSkus(allSkus)
  }, [data.recommendations])

  useEffect(() => {
    const loadCriticalSkus = async () => {
      setIsCriticalLoading(true)

      try {
        const response = await fetch(`/api/critical-skus?days=${criticalThreshold}`)
        if (!response.ok) throw new Error('failed to load critical skus')
        const payload = await response.json()
        setCriticalSkus(payload.items)
      } catch {
        setCriticalSkus(buildFallbackCriticalSkus(data.recommendations, criticalThreshold))
      } finally {
        setIsCriticalLoading(false)
      }
    }

    loadCriticalSkus()
  }, [criticalThreshold, data.recommendations])

  useEffect(() => {
    setPlanResult(null)
  }, [horizonDays, selectedSkus])

  const skuOptions = useMemo(
    () => [...new Set(data.recommendations.map((item) => item.sku))],
    [data.recommendations],
  )

  const activeRecommendations = useMemo(
    () => data.recommendations.filter((item) => selectedSkus.includes(item.sku)),
    [data.recommendations, selectedSkus],
  )

  const toggleSkuFilter = (sku) => {
    setSelectedSkus((current) => {
      if (current.includes(sku)) {
        return current.filter((value) => value !== sku)
      }
      return [...current, sku]
    })
  }

  const generatePlan = async () => {
    if (!selectedSkus.length) {
      setApiError('Выберите минимум один SKU для формирования поставки.')
      return
    }

    setApiError('')
    setIsPlanLoading(true)
    try {
      const response = await fetch('/api/supply-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horizonDays,
          selectedSkus,
        }),
      })
      if (!response.ok) throw new Error('Plan generation failed')
      const payload = await response.json()
      setPlanResult(payload)
    } catch {
      setPlanResult(null)
      setApiError('Не удалось сформировать план через API. Проверь запуск backend на порту 8080.')
    } finally {
      setIsPlanLoading(false)
    }
  }

  const downloadPlanCsv = async () => {
    if (!selectedSkus.length) {
      setCsvStatus('Выберите SKU перед экспортом.')
      return
    }

    setIsCsvLoading(true)
    setCsvStatus('')

    try {
      const params = new URLSearchParams({
        horizonDays: String(horizonDays),
        selectedSkus: selectedSkus.join(','),
      })

      const response = await fetch(`/api/supply-plan-export?${params.toString()}`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const fileName =
        parseFileNameFromDisposition(response.headers.get('content-disposition')) ||
        `malogist-supply-plan-${Date.now()}.csv`

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setCsvStatus('CSV выгружен.')
    } catch {
      setCsvStatus('Не удалось выгрузить CSV.')
    } finally {
      setIsCsvLoading(false)
    }
  }

  const sendTelegramTest = async () => {
    setIsTelegramLoading(true)
    setTelegramStatus('')

    const topRiskSku = criticalSkus[0]
    const message = topRiskSku
      ? `MaLogist: проверь SKU ${topRiskSku.sku} на складе ${topRiskSku.warehouse}. До out-of-stock ${topRiskSku.daysLeft} дн.`
      : 'MaLogist: тестовое уведомление. Критичных SKU на текущем горизонте нет.'

    try {
      const response = await fetch('/api/notifications/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message ?? 'Telegram error')
      setTelegramStatus(payload.message)
    } catch (error) {
      setTelegramStatus(error.message)
    } finally {
      setIsTelegramLoading(false)
    }
  }

  if (view === 'login') {
    return <LoginView onLoginSuccess={handleLoginSuccess} onBack={() => setView('landing')} />
  }

  if (view === 'cabinet' && authToken) {
    return (
      <SellerCabinet
        token={authToken}
        user={authUser}
        onBack={() => setView('landing')}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <LandingView
      data={data}
      apiError={apiError}
      horizonDays={horizonDays}
      setHorizonDays={setHorizonDays}
      selectedSkus={selectedSkus}
      toggleSkuFilter={toggleSkuFilter}
      skuOptions={skuOptions}
      activeRecommendations={activeRecommendations}
      generatePlan={generatePlan}
      isPlanLoading={isPlanLoading}
      downloadPlanCsv={downloadPlanCsv}
      isCsvLoading={isCsvLoading}
      csvStatus={csvStatus}
      planResult={planResult}
      criticalThreshold={criticalThreshold}
      setCriticalThreshold={setCriticalThreshold}
      isCriticalLoading={isCriticalLoading}
      criticalSkus={criticalSkus}
      isTelegramLoading={isTelegramLoading}
      sendTelegramTest={sendTelegramTest}
      telegramStatus={telegramStatus}
      openCabinet={openCabinet}
    />
  )
}

export default App
