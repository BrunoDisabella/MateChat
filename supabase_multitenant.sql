
-- Tabla para configuración de usuarios (Multi-tenant)
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,   -- ID del usuario (Supabase Auth o email)
    api_key TEXT NOT NULL,          -- API Key única por usuario
    webhooks JSONB DEFAULT '[]',    -- Array de webhooks
    whatsapp_status TEXT DEFAULT 'disconnected', -- 'disconnected', 'qr_pending', 'connected'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_api_key ON user_settings(api_key);

-- Política RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" 
    ON user_settings FOR SELECT 
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update own settings" 
    ON user_settings FOR UPDATE 
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own settings" 
    ON user_settings FOR INSERT 
    WITH CHECK (auth.uid()::text = user_id);
