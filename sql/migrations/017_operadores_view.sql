-- ============================================================
-- Migração 017: View de operadores para delegação
-- Expõe nomes de auth.users para o frontend via view segura
-- ============================================================

-- View que expõe apenas id e nome dos usuários autenticados
-- Necessária porque auth.users não é acessível diretamente do client
-- SEGURANÇA: expõe apenas nome e role, sem email
CREATE OR REPLACE VIEW public.operadores AS
SELECT
  id,
  COALESCE(
    raw_user_meta_data->>'nome',
    raw_user_meta_data->>'full_name',
    split_part(email, '@', 1)
  ) AS nome,
  raw_user_meta_data->>'role' AS role
FROM auth.users;

-- Permitir leitura para authenticated
GRANT SELECT ON public.operadores TO authenticated;
