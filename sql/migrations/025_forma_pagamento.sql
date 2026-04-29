ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS valor_entrada NUMERIC DEFAULT 0;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS percentual_exito NUMERIC DEFAULT 30;
ALTER TABLE atendimentos ADD COLUMN IF NOT EXISTS tipo_honorario TEXT DEFAULT 'entrada_exito';
