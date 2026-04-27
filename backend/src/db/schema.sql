CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  marketplace_type TEXT NOT NULL CHECK (marketplace_type IN ('wb', 'ozon', 'yandex')),
  api_key_encrypted TEXT,
  client_id_encrypted TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  marketplace_product_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouses (
  id BIGSERIAL PRIMARY KEY,
  marketplace_type TEXT NOT NULL CHECK (marketplace_type IN ('wb', 'ozon', 'yandex')),
  marketplace_warehouse_id TEXT NOT NULL,
  name TEXT NOT NULL,
  region TEXT,
  city TEXT,
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  logistics_coefficient NUMERIC(10, 4) NOT NULL DEFAULT 1,
  storage_coefficient NUMERIC(10, 4) NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS product_stocks (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  marketplace_order_id TEXT NOT NULL,
  warehouse_id BIGINT REFERENCES warehouses(id) ON DELETE SET NULL,
  region TEXT,
  city TEXT,
  quantity INTEGER NOT NULL,
  price NUMERIC(12, 2) NOT NULL,
  ordered_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_daily (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id BIGINT REFERENCES warehouses(id) ON DELETE SET NULL,
  region TEXT,
  date DATE NOT NULL,
  quantity_sold INTEGER NOT NULL,
  revenue NUMERIC(12, 2) NOT NULL,
  UNIQUE(product_id, warehouse_id, region, date)
);

CREATE TABLE IF NOT EXISTS logistics_costs (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id BIGINT REFERENCES warehouses(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  delivery_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  storage_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  return_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS forecast_settings (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  forecast_days INTEGER NOT NULL DEFAULT 28,
  safety_stock_days INTEGER NOT NULL DEFAULT 5,
  min_stock_units INTEGER NOT NULL DEFAULT 0,
  target_turnover_days INTEGER NOT NULL DEFAULT 28,
  strategy TEXT NOT NULL DEFAULT 'balanced' CHECK (strategy IN ('speed', 'margin', 'balanced'))
);

CREATE TABLE IF NOT EXISTS product_rules (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  always_keep_stock BOOLEAN NOT NULL DEFAULT FALSE,
  min_stock_units INTEGER,
  max_stock_units INTEGER,
  preferred_warehouse_id BIGINT REFERENCES warehouses(id) ON DELETE SET NULL,
  excluded_warehouse_ids BIGINT[]
);

CREATE TABLE IF NOT EXISTS supply_recommendations (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id BIGINT REFERENCES warehouses(id) ON DELETE SET NULL,
  current_stock INTEGER NOT NULL,
  avg_daily_sales NUMERIC(12, 4) NOT NULL,
  forecast_sales NUMERIC(12, 4) NOT NULL,
  days_until_stockout NUMERIC(12, 4),
  recommended_quantity INTEGER NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  telegram_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  stockout_alert_days INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('wb', 'ozon', 'yandex')),
  name TEXT NOT NULL,
  credentials_encrypted TEXT NOT NULL,
  external_business_id TEXT,
  external_campaign_id TEXT,
  seller_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disabled')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_products (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES marketplace_accounts(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('wb', 'ozon', 'yandex')),
  external_product_id TEXT NOT NULL,
  external_sku TEXT,
  offer_id TEXT,
  barcode TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  image_url TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_warehouses (
  id BIGSERIAL PRIMARY KEY,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('wb', 'ozon', 'yandex')),
  external_warehouse_id TEXT NOT NULL,
  name TEXT NOT NULL,
  region TEXT,
  city TEXT,
  address TEXT,
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  is_marketplace_warehouse BOOLEAN NOT NULL DEFAULT TRUE,
  raw_payload JSONB
);

CREATE TABLE IF NOT EXISTS marketplace_stocks (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES marketplace_accounts(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES marketplace_products(id) ON DELETE SET NULL,
  warehouse_id BIGINT REFERENCES marketplace_warehouses(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  in_way_to_client INTEGER NOT NULL DEFAULT 0,
  in_way_from_client INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  sync_source TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES marketplace_accounts(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES marketplace_products(id) ON DELETE SET NULL,
  warehouse_id BIGINT REFERENCES marketplace_warehouses(id) ON DELETE SET NULL,
  external_order_id TEXT NOT NULL,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('wb', 'ozon', 'yandex')),
  order_type TEXT,
  region TEXT,
  city TEXT,
  quantity INTEGER NOT NULL,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  ordered_at TIMESTAMPTZ NOT NULL,
  raw_payload JSONB
);

CREATE TABLE IF NOT EXISTS marketplace_sales_daily (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES marketplace_accounts(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES marketplace_products(id) ON DELETE SET NULL,
  warehouse_id BIGINT REFERENCES marketplace_warehouses(id) ON DELETE SET NULL,
  region TEXT,
  date DATE NOT NULL,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  quantity_returned INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC(12, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS marketplace_tariffs (
  id BIGSERIAL PRIMARY KEY,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('wb', 'ozon', 'yandex')),
  warehouse_id BIGINT REFERENCES marketplace_warehouses(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  delivery_coefficient NUMERIC(10, 4),
  storage_coefficient NUMERIC(10, 4),
  acceptance_coefficient NUMERIC(10, 4),
  return_coefficient NUMERIC(10, 4),
  allow_unload BOOLEAN,
  raw_payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_products_account_id ON products(account_id);
CREATE INDEX IF NOT EXISTS idx_orders_account_id ON orders(account_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_daily_product_date ON sales_daily(product_id, date);
CREATE INDEX IF NOT EXISTS idx_product_stocks_product_id ON product_stocks(product_id);
CREATE INDEX IF NOT EXISTS idx_supply_recommendations_account_id ON supply_recommendations(account_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_accounts_user_id ON marketplace_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_accounts_seller_account ON marketplace_accounts(seller_account_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_account_id ON marketplace_products(account_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_stocks_account_id ON marketplace_stocks(account_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_account_id ON marketplace_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_sales_daily_account_date ON marketplace_sales_daily(account_id, date);
