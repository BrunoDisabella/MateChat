
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
    port: process.env.PORT || 3001,
    n8nWebhookUrl: process.env.N8N_WEBHOOK_URL,
    paths: {
        root: path.resolve(__dirname, '../../'),
        dist: path.resolve(__dirname, '../../dist'),
        public: path.resolve(__dirname, '../../public')
    }
};
