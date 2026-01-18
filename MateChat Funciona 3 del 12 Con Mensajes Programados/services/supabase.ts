import { createClient } from '@supabase/supabase-js';

// NOTA: Estas credenciales están hardcodeadas para este entorno de desarrollo.
// En producción, muévelas a un archivo .env y usa import.meta.env.VITE_SUPABASE_URL
const SUPABASE_URL = 'https://oheapcbdvgmrmecgktak.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oZWFwY2Jkdmdtcm1lY2drdGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MDY1MjMsImV4cCI6MjA3NzE4MjUyM30.h2I4EVQDTp9sXK7TkAmbDRXLi4Ar5Z_1zVeeTlBSpwI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);