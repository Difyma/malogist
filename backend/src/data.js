export const landingData = {
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
    'Подключаешь кабинеты маркетплейсов и остатки из учета.',
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
}

export function buildSupplyPlan({
  horizonDays = 28,
  selectedSkus = [],
  recommendations = landingData.recommendations,
}) {
  const normalizedHorizon = Number(horizonDays) || 28
  const horizonFactor = normalizedHorizon / 28

  const filtered = recommendations.filter((item) => {
    if (!selectedSkus.length) return true
    return selectedSkus.includes(item.sku)
  })

  const plan = filtered.map((item) => ({
    ...item,
    recommendation: Math.max(0, Math.round(item.recommendation * horizonFactor)),
  }))

  const totalUnits = plan.reduce((sum, item) => sum + item.recommendation, 0)
  const urgentSkus = plan.filter((item) => item.daysLeft <= 5).length

  return {
    horizonDays: normalizedHorizon,
    generatedAt: new Date().toISOString(),
    items: plan,
    summary: {
      totalUnits,
      urgentSkus,
      warehousesInPlan: new Set(plan.map((item) => item.warehouse)).size,
    },
  }
}

export function getCriticalSkus({
  thresholdDays = 5,
  recommendations = landingData.recommendations,
}) {
  const normalizedThreshold = Number(thresholdDays) || 5

  return recommendations
    .filter((item) => item.daysLeft <= normalizedThreshold)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .map((item) => ({
      ...item,
      riskLevel: item.daysLeft <= 3 ? 'critical' : 'warning',
    }))
}

function toCsvField(value) {
  if (value === null || value === undefined) return '""'
  const text = String(value).replaceAll('"', '""')
  return `"${text}"`
}

export function supplyPlanToCsv(plan) {
  const rows = [
    [
      'SKU',
      'Склад',
      'Остаток',
      'Дней хватит',
      'Рекомендация к поставке',
      'Действие',
      'Горизонт прогноза',
      'Сформировано',
    ],
    ...plan.items.map((item) => [
      item.sku,
      item.warehouse,
      item.stock,
      item.daysLeft,
      item.recommendation,
      item.action,
      `${plan.horizonDays} дней`,
      plan.generatedAt,
    ]),
  ]

  const body = rows.map((row) => row.map(toCsvField).join(';')).join('\n')
  return `\uFEFF${body}`
}
