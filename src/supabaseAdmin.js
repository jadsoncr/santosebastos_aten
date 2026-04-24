// src/supabaseAdmin.js
// Singleton Supabase client com service_role key.
// Reutilizado por identityResolver.js e handlers Socket.io em server.js.

let supabase;

function getSupabase() {
  if (!supabase) {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }
  return supabase;
}

module.exports = { getSupabase };
