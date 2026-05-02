-- Migration 029: RLS INSERT policies for identities, identity_channels, leads
-- Needed for "Novo Contato" modal (authenticated user creates contacts manually)

-- ── 1. INSERT policy for identities ──
DROP POLICY IF EXISTS "authenticated_insert_identities" ON identities;
CREATE POLICY "authenticated_insert_identities" ON identities
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── 2. INSERT policy for identity_channels ──
DROP POLICY IF EXISTS "authenticated_insert_identity_channels" ON identity_channels;
CREATE POLICY "authenticated_insert_identity_channels" ON identity_channels
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── 3. INSERT policy for leads ──
DROP POLICY IF EXISTS "authenticated_insert_leads" ON leads;
CREATE POLICY "authenticated_insert_leads" ON leads
  FOR INSERT TO authenticated WITH CHECK (true);
