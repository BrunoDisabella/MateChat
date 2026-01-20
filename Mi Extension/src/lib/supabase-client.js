// Importamos desde el archivo que descargaste en el Paso 1
import * as SupabaseRaw from './supabase-dist.js';

// Robust Import Strategy
let createClient;
if (SupabaseRaw.createClient) {
  createClient = SupabaseRaw.createClient;
} else if (SupabaseRaw.default && SupabaseRaw.default.createClient) {
  createClient = SupabaseRaw.default.createClient;
} else if (typeof self !== 'undefined' && self.supabase && self.supabase.createClient) {
  createClient = self.supabase.createClient; // Global fallback
} else {
  console.error("CRITICAL: Could not find createClient in Supabase lib", SupabaseRaw);
}


// Credenciales de Supabase (Proyecto MateChat: oheapcbdvgmrmecgktak)
const SUPABASE_URL = 'https://oheapcbdvgmrmecgktak.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oZWFwY2Jkdmdtcm1lY2drdGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MDY1MjMsImV4cCI6MjA3NzE4MjUyM30.h2I4EVQDTp9sXK7TkAmbDRXLi4Ar5Z_1zVeeTlBSpwI';


export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ChromeStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});