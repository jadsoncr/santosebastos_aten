-- Migration 030: Consolidação do modelo operacional
-- 1. origem_entrada em leads (manual vs automatico)
-- 2. UPDATE policy em identities
-- 3. UPDATE policy em identity_channels
-- 4. meta JSONB em status_transitions (auditoria de prereqs)

-- ── 1. Campo origem_entrada em leads ──
ALTER TABLE leads ADD COLUMN IF NOT EXISTS origem_entrada TEXT DEFAULT 'automatico';

-- ── 2. UPDATE policy para identities (editar nome/telefone) ──
DROP POLICY IF EXISTS "authenticated_update_identities" ON identities;
CREATE POLICY "authenticated_update_identities" ON identities
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── 3. UPDATE policy para identity_channels ──
DROP POLICY IF EXISTS "authenticated_update_identity_channels" ON identity_channels;
CREATE POLICY "authenticated_update_identity_channels" ON identity_channels
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── 4. meta JSONB em status_transitions (prereq audit trail) ──
ALTER TABLE status_transitions ADD COLUMN IF NOT EXISTS meta JSONB;
