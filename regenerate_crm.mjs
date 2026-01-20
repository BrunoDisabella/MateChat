
import fs from 'fs';
import path from 'path';

const crmPath = path.join(process.cwd(), 'Mi Extension', 'crm_logic.js');
const tempPath = path.join(process.cwd(), 'Mi Extension', 'temp_config_module.js');

try {
    let content = fs.readFileSync(crmPath, 'utf8');
    const tempContent = fs.readFileSync(tempPath, 'utf8');

    // 1. Sanitize: Remove the appended module if it exists to start fresh
    const splitKey = '// ==========================================\n// 10. MÓDULO: CONFIGURACIÓN MATECHAT';
    if (content.includes(splitKey)) {
        content = content.split(splitKey)[0];
    }

    // 2. Ensure the startup loop exists
    // The critical line that starts the extension logic
    const startupLine = 'const arranque = setInterval(() => { if (window.WPP && window.WPP.isReady) { clearInterval(arranque); iniciarVigilante(); }}, 1000);';

    if (!content.includes('const arranque = setInterval')) {
        console.log('Startup loop missing. Re-adding...');
        // Clean up end of file before appending
        content = content.trim() + '\n\n' + startupLine;
    } else {
        // Ensure it's at the end and clean
        // If it exists but is corrupted, this might not fix it.
        // Let's force replace the end of the file if we can find the marker before it.
        const marker = 'function initSupabaseConnection()';
        const idx = content.lastIndexOf(marker);
        if (idx !== -1) {
            // Find end of that function line? It's a one-liner in the source I saw:
            // ...localStorage.setItem('crm_cloud_user', JSON.stringify(e.data.payload.user)); }); }
            // Let's just looking for the closing brace of that function
            const endOfFunc = content.indexOf('}', idx);
            // This is risky.
            // Safer: Just make sure 'content' ends with the startupLine.
            const startupIdx = content.lastIndexOf('const arranque = setInterval');
            content = content.substring(0, startupIdx).trim() + '\n\n' + startupLine;
        }
    }

    // 3. Append the new module
    const finalContent = content.trim() + '\n\n' + tempContent;

    fs.writeFileSync(crmPath, finalContent, 'utf8');
    console.log('SUCCESS: Regenerated crm_logic.js');

} catch (e) {
    console.error(e);
}
