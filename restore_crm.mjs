import fs from 'fs';
import path from 'path';

const crmPath = path.join(process.cwd(), 'Mi Extension', 'crm_logic.js');
const tempPath = path.join(process.cwd(), 'Mi Extension', 'temp_config_module.js');

try {
    console.log(`Processing: ${crmPath}`);

    // 1. Truncate to recover original clean file
    // Open for Read/Write
    const fd = fs.openSync(crmPath, 'r+');
    fs.ftruncateSync(fd, 51572);
    fs.closeSync(fd);
    console.log('SUCCESS: Truncated crm_logic.js to 51572 bytes.');

    // 2. Read Clean Config Module
    const tempContent = fs.readFileSync(tempPath, 'utf8');

    // 3. Append Cleanly
    fs.appendFileSync(crmPath, '\n\n' + tempContent, 'utf8');
    console.log('SUCCESS: Appended temp_config_module.js.');

} catch (e) {
    console.error('ERROR:', e);
}
