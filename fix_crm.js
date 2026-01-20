const fs = require('fs');
const path = require('path');

const crmPath = path.join(process.cwd(), 'Mi Extension', 'crm_logic.js');
const tempPath = path.join(process.cwd(), 'Mi Extension', 'temp_config_module.js');

try {
    let crmContent = fs.readFileSync(crmPath, 'utf8');
    const tempContent = fs.readFileSync(tempPath, 'utf8');

    // Remove any previous bad append (look for the header)
    const splitKey = '// ==========================================\n// 10. MÓDULO: CONFIGURACIÓN MATECHAT';
    if (crmContent.includes(splitKey)) {
        crmContent = crmContent.split(splitKey)[0];
    }

    // Also remove any potential NULL bytes or binary garbage at the end
    crmContent = crmContent.replace(/\0/g, '');

    // Re-append cleanly
    const finalContent = crmContent.trim() + '\n\n' + tempContent.trim();

    fs.writeFileSync(crmPath, finalContent, 'utf8');
    console.log('Successfully repaired crm_logic.js');

} catch (err) {
    console.error('Error fixing files:', err);
}
