
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
    port: process.env.PORT || 3001,
    n8nWebhookUrl: process.env.N8N_WEBHOOK_URL,
    // Supabase credentials for scheduler
    supabaseUrl: process.env.SUPABASE_URL || 'https://oheapcbdvgmrmecgktak.supabase.co',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oZWFwY2Jkdmdtcm1lY2drdGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MDY1MjMsImV4cCI6MjA3NzE4MjUyM30.h2I4EVQDTp9sXK7TkAmbDRXLi4Ar5Z_1zVeeTlBSpwI',
    paths: {
        root: path.resolve(__dirname, '../../'),
        dist: path.resolve(__dirname, '../../dist'),
        public: path.resolve(__dirname, '../../public')
    }
};
