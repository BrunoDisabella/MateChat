
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({ origin: (origin, callback) => callback(null, true) }));
app.use(express.json({ limit: '10mb' }));

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, MERCADOLIBRE_APP_ID, MERCADOLIBRE_SECRET_KEY } = process.env;
let supabase = null;
let isConfigured = false;
const PROCESS_ID = `PID-${process.pid}`;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn(`[${PROCESS_ID}] ⚠️ ADVERTENCIA: Faltan variables de entorno de Supabase.`);
} else {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    isConfigured = true;
}

app.get('/', (req, res) => res.send(`MateCRM Backend Activo. PID: ${process.pid}`));

// VERIFICACIÓN DE TOKEN BILLER v2 (PRODUCCIÓN)
app.post('/api/billing/verify', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: "Falta el token API." });

    console.log(`[${PROCESS_ID}] 🔍 Validando Token Biller v2 en Producción...`);
    try {
        // Usamos el endpoint v2 de consulta DGI como prueba de conexión real
        const response = await axios.get('https://biller.uy/v2/dgi/empresas/datos-entidad', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            params: { ruc: '219999990015' } // RUC de prueba para verificar conexión
        });
        console.log(`[${PROCESS_ID}] ✅ Token Biller v2 verificado.`);
        res.json({ success: true });
    } catch (error) {
        const status = error.response?.status || 500;
        let msg = error.response?.data?.mensaje || error.message;
        
        // Si el error es 403, es porque el token no es válido para producción
        if (status === 401 || status === 403) msg = "Token no autorizado o expirado. Revisa tu panel en biller.uy";
        
        console.error(`[${PROCESS_ID}] ❌ Error validando con Biller v2: ${msg}`);
        res.status(status).json({ success: false, details: msg });
    }
});

// EMISIÓN DE COMPROBANTE v2 (PRODUCCIÓN)
app.post('/api/billing/issue', async (req, res) => {
    const { saleId, apiKey, sucursalId, saleData } = req.body;
    if (!apiKey || !sucursalId) return res.status(400).json({ error: "Credenciales incompletas." });

    console.log(`[${PROCESS_ID}] 🧾 Emitiendo e-Ticket v2 (Producción) para venta ${saleId}...`);
    try {
        // Mapeo riguroso según documentación v2 (Snake Case)
        const billerItems = saleData.items.map(item => ({
            codigo: item.sku,
            concepto: item.name,
            cantidad: item.quantity,
            precio: item.unitPrice,
            indicador_facturacion: 3 // Tasa Básica (22%)
        }));

        const payload = {
            tipo_comprobante: 101, // e-Ticket
            forma_pago: 1,         // Contado
            sucursal: parseInt(sucursalId),
            moneda: "UYU",
            montos_brutos: 0,      // 0 = API calcula el IVA automáticamente
            items: billerItems,
            receptor: {
                tipo_documento: saleData.customerRnt ? (saleData.customerRnt.length === 12 ? "RUT" : "CI") : "CI",
                documento: saleData.customerRnt || "11111111", 
                nombre: saleData.customerName || "Consumidor Final"
            }
        };

        const billerResponse = await axios.post('https://biller.uy/v2/comprobantes/crear', payload, {
            headers: { 
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const invoiceData = billerResponse.data;
        
        if (supabase) {
            await supabase.from('sales').update({
                billingStatus: 'invoiced',
                billerId: invoiceData.id,
                invoiceUrl: invoiceData.pdf_url || `https://app.biller.uy/comprobantes/${invoiceData.id}`
            }).eq('id', saleId);
        }
        
        res.json({ success: true, invoice: invoiceData });

    } catch (error) {
        if (error.response?.status === 429) {
            return res.status(429).json({ 
                error: "Límite de velocidad excedido", 
                details: "Biller permite 1 factura por segundo. Espera un momento." 
            });
        }

        const msg = error.response?.data?.mensaje || error.response?.data?.message || error.message;
        console.error(`[${PROCESS_ID}] ❌ Error Biller API v2:`, msg);
        res.status(500).json({ error: "Error en Biller v2", details: msg });
    }
});

// Rutas ML... (Se mantienen igual)
app.get('/api/mercadolibre/auth/status', async (req, res) => {
    if (!isConfigured) return res.json({ authenticated: false });
    const { data } = await supabase.from('mercadolibre_tokens').select('id').limit(1);
    res.json({ authenticated: data && data.length > 0 });
});

app.post('/api/mercadolibre/auth/exchange-code', async (req, res) => {
    const { code, redirectUri, codeVerifier } = req.body;
    try {
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: MERCADOLIBRE_APP_ID,
            client_secret: MERCADOLIBRE_SECRET_KEY,
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier
        });
        const response = await axios.post('https://api.mercadolibre.com/oauth/token', params);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Backend MateCRM en puerto ${PORT}`));
