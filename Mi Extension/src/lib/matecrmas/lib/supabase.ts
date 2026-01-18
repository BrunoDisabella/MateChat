
import { createClient } from '@supabase/supabase-js';

// Intenta obtener las claves desde variables de entorno (Vite)
// Usamos un objeto vacío como fallback para 'env' si no está definido (ej. Babel Standalone en el navegador)
// para evitar el error "Cannot read properties of undefined".
const env = (import.meta as any).env || {};

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://taeldbihtqjhaxzmrlbx.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhZWxkYmlodHFqaGF4em1ybGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5Mzc0ODAsImV4cCI6MjA3ODUxMzQ4MH0.Sue-CshgyhvXF9M_yY_Q-5mQDGc3bmHD8lT-QLYGCNU';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Faltan las credenciales de Supabase. Asegúrate de configurar el archivo .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
