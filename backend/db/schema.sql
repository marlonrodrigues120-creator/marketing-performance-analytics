-- =====================================================================
-- Marketing Performance Analytics — modelo relacional (PostgreSQL 15+)
-- Fato principal: marketing_metrics (grão: campanha × dia).
-- Leads, conversões e receita também têm tabelas de eventos para
-- rastreabilidade e para modelos de atribuição além do last-click.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ---------- Acesso ----------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,                       -- bcrypt
  role          TEXT NOT NULL CHECK (role IN ('admin', 'analyst', 'viewer')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Dimensões de marketing ----------
CREATE TABLE marketing_channels (
  id          TEXT PRIMARY KEY,                       -- 'google', 'meta', ...
  name        TEXT NOT NULL UNIQUE,
  kind        TEXT NOT NULL CHECK (kind IN ('Pago', 'Orgânico')),
  color       TEXT
);

CREATE TABLE campaigns (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  channel_id       TEXT NOT NULL REFERENCES marketing_channels(id),
  platform         TEXT NOT NULL,
  objective        TEXT NOT NULL CHECK (objective IN ('Vendas', 'Geração de leads', 'Awareness')),
  conversion_type  TEXT NOT NULL CHECK (conversion_type IN ('Compra', 'Assinatura', 'Demo agendada', 'Cadastro')),
  status           TEXT NOT NULL DEFAULT 'Ativa' CHECK (status IN ('Ativa', 'Pausada', 'Encerrada')),
  start_date       DATE NOT NULL,
  end_date         DATE,
  owner            TEXT,
  external_id      TEXT,                                -- id na plataforma de anúncios
  tags             TEXT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);
CREATE INDEX ix_campaigns_channel ON campaigns(channel_id);

CREATE TABLE budgets (
  id           BIGSERIAL PRIMARY KEY,
  campaign_id  TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  month        DATE NOT NULL CHECK (date_trunc('month', month) = month),
  planned      NUMERIC(14,2) NOT NULL CHECK (planned >= 0),
  UNIQUE (campaign_id, month)
);

-- ---------- Fato diário ----------
CREATE TABLE marketing_metrics (
  id             BIGSERIAL PRIMARY KEY,
  date           DATE NOT NULL,
  campaign_id    TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  media_spend    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (media_spend >= 0),
  other_cost     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (other_cost >= 0),  -- produção, ferramentas, agência
  impressions    BIGINT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks         BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  visitors       BIGINT NOT NULL DEFAULT 0 CHECK (visitors >= 0),
  source         TEXT NOT NULL DEFAULT 'demo' CHECK (source IN ('demo', 'import', 'api')),
  import_id      UUID,
  UNIQUE (date, campaign_id, source)                   -- evita duplicidade por origem
);
CREATE INDEX ix_metrics_date ON marketing_metrics(date);
CREATE INDEX ix_metrics_campaign_date ON marketing_metrics(campaign_id, date);

-- ---------- Eventos de funil (rastreabilidade) ----------
CREATE TABLE leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL,
  email_hash     TEXT,                                  -- nunca o e-mail em claro
  stage          TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'opportunity', 'customer', 'lost')),
  crm_id         TEXT
);
CREATE INDEX ix_leads_campaign_created ON leads(campaign_id, created_at);

CREATE TABLE conversions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        UUID REFERENCES leads(id) ON DELETE SET NULL,
  campaign_id    TEXT REFERENCES campaigns(id) ON DELETE SET NULL,   -- campanha atribuída
  converted_at   TIMESTAMPTZ NOT NULL,
  conversion_type TEXT NOT NULL,
  attribution_model TEXT NOT NULL DEFAULT 'last-click'
);
CREATE INDEX ix_conversions_campaign_date ON conversions(campaign_id, converted_at);

CREATE TABLE revenue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_id  UUID REFERENCES conversions(id) ON DELETE CASCADE,
  order_id       TEXT NOT NULL UNIQUE,
  amount         NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  occurred_at    TIMESTAMPTZ NOT NULL
);

-- Agregado diário de funil/receita (materializado a partir dos eventos ou
-- carregado diretamente quando a fonte já entrega o dado consolidado).
CREATE TABLE funnel_daily (
  date           DATE NOT NULL,
  campaign_id    TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  leads          INT NOT NULL DEFAULT 0,
  opportunities  INT NOT NULL DEFAULT 0,
  customers      INT NOT NULL DEFAULT 0,
  orders         INT NOT NULL DEFAULT 0,
  revenue        NUMERIC(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (date, campaign_id)
);

-- ---------- Automação ----------
CREATE TABLE workflows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'paused', 'draft')),
  template_id      TEXT,
  definition       JSONB NOT NULL,                    -- nós e conexões do editor visual
  n8n_workflow_id  TEXT,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workflow_executions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id      UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  idempotency_key  TEXT NOT NULL UNIQUE,              -- impede execução duplicada
  mode             TEXT NOT NULL CHECK (mode IN ('schedule', 'event', 'manual', 'test')),
  status           TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'error', 'skipped')),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  duration_ms      INT,
  input            JSONB NOT NULL DEFAULT '{}',
  result           JSONB,
  error_message    TEXT,
  n8n_execution_id TEXT,
  attempt          INT NOT NULL DEFAULT 1
);
CREATE INDEX ix_exec_workflow_started ON workflow_executions(workflow_id, started_at DESC);

CREATE TABLE automation_logs (
  id           BIGSERIAL PRIMARY KEY,
  at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  level        TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  workflow_id  UUID REFERENCES workflows(id) ON DELETE SET NULL,
  execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
  user_id      UUID REFERENCES users(id),
  message      TEXT NOT NULL
);

CREATE TABLE ai_insights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  rule          TEXT NOT NULL,
  priority      TEXT NOT NULL CHECK (priority IN ('Alta', 'Média', 'Baixa')),
  entity_type   TEXT NOT NULL,
  entity_id     TEXT,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  evidence      JSONB NOT NULL,                       -- números que sustentam o insight
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  execution_id  UUID REFERENCES workflow_executions(id) ON DELETE SET NULL
);

-- ---------- Integrações e importações ----------
CREATE TABLE integrations (
  id              TEXT PRIMARY KEY,                   -- 'google_ads', 'meta', 'ga4', 'n8n', ...
  status          TEXT NOT NULL DEFAULT 'disconnected',
  config          JSONB NOT NULL DEFAULT '{}',        -- sem segredos
  encrypted_token BYTEA,                              -- tokens OAuth criptografados (pgcrypto/KMS)
  last_sync_at    TIMESTAMPTZ,
  last_error      TEXT
);

CREATE TABLE data_imports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name     TEXT NOT NULL,
  user_id       UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_rows    INT NOT NULL,
  inserted_rows INT NOT NULL,
  duplicate_rows INT NOT NULL,
  error_rows    INT NOT NULL,
  mapping       JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'reverted', 'failed'))
);
ALTER TABLE marketing_metrics ADD CONSTRAINT fk_metrics_import FOREIGN KEY (import_id) REFERENCES data_imports(id) ON DELETE CASCADE;

-- ---------- Visão analítica: KPIs com divisões seguras ----------
CREATE VIEW vw_campaign_daily AS
SELECT m.date, m.campaign_id, c.channel_id, c.platform, c.conversion_type,
       SUM(m.media_spend) AS media_spend,
       SUM(m.other_cost) AS other_cost,
       SUM(m.media_spend + m.other_cost) AS investment,
       SUM(m.impressions) AS impressions,
       SUM(m.clicks) AS clicks,
       SUM(CASE WHEN m.media_spend > 0 THEN m.clicks ELSE 0 END) AS paid_clicks,
       SUM(m.visitors) AS visitors,
       COALESCE(MAX(f.leads), 0) AS leads,
       COALESCE(MAX(f.opportunities), 0) AS opportunities,
       COALESCE(MAX(f.customers), 0) AS customers,
       COALESCE(MAX(f.orders), 0) AS orders,
       COALESCE(MAX(f.revenue), 0) AS revenue
FROM marketing_metrics m
JOIN campaigns c ON c.id = m.campaign_id
LEFT JOIN funnel_daily f ON f.date = m.date AND f.campaign_id = m.campaign_id
GROUP BY m.date, m.campaign_id, c.channel_id, c.platform, c.conversion_type;

-- Exemplo de consulta de KPIs (ROI usa margem parametrizada; receita ≠ lucro):
-- SELECT channel_id,
--        SUM(investment) / NULLIF(SUM(customers), 0)                            AS cac,
--        SUM(investment) / NULLIF(SUM(leads), 0)                                AS cpl,
--        SUM(revenue) / NULLIF(SUM(media_spend), 0)                             AS roas,
--        (SUM(revenue) * :margin - SUM(investment)) / NULLIF(SUM(investment), 0) * 100 AS roi,
--        SUM(clicks)::numeric / NULLIF(SUM(impressions), 0) * 100               AS ctr,
--        SUM(media_spend) / NULLIF(SUM(paid_clicks), 0)                         AS cpc
-- FROM vw_campaign_daily WHERE date BETWEEN :start AND :end GROUP BY channel_id;
