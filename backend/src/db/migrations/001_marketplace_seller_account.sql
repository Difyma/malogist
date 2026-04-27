-- Связь интеграции с кабинетным аккаунтом (products.account_id → accounts.id)
ALTER TABLE marketplace_accounts
  ADD COLUMN IF NOT EXISTS seller_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_accounts_seller_account ON marketplace_accounts(seller_account_id);
