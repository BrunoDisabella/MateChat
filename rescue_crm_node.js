const fs = require('fs');
const path = require('path');

const crmPath = path.join(process.cwd(), 'Mi Extension', 'crm_logic.js');
const tempPath = path.join(process.cwd(), 'Mi Extension', 'temp_config_module.js');

try {
    // Read as buffer to avoid encoding errors
    const crmBuffer = fs.readFileSync(crmPath);
    let contentStr = crmBuffer.toString('binary'); // Treat as binary string first

    // Find the split key
    const splitKey = '// ==========================================\n// 10. MÓDULO: CONFIGURACIÓN MATECHAT';
    const splitIndex = contentStr.indexOf(splitKey);

    if (splitIndex !== -1) {
        console.log("Found split key, truncating...");
        // Truncate at index
        contentStr = contentStr.substring(0, splitIndex);
    } else {
        // If key not found, maybe look for the end of the original valid file?
        // Original file ended with `iniciarVigilante(); }}, 1000);`
        const endKey = 'iniciarVigilante(); }}, 1000);';
        const endIndex = contentStr.lastIndexOf(endKey);
        if (endIndex !== -1) {
            console.log("Found end key, truncating after it...");
            contentStr = contentStr.substring(0, endIndex + endKey.length);
        }
    }

    // Read temp module (this one is clean UTF8)
    const tempContent = fs.readFileSync(tempPath, 'utf8');

    // Merge
    // We treating contentStr as binary, but we want to write valid UTF8.
    // If original was UTF8, 'binary' string might have multi-byte chars as single byte chars.
    // Actually, let's try 'utf8' reading with a catch? 
    // No, Buffer -> String via UTF8 might throw or replace.

    // Better approach: Use the END KEY to find the cut point in the BUFFER.
    // "iniciarVigilante(); }}, 1000);"

    const endKeyBuf = Buffer.from('iniciarVigilante(); }}, 1000);');
    const idx = crmBuffer.indexOf(endKeyBuf);

    let finalBuffer;
    if (idx !== -1) {
        // Slice buffer up to end of key
        const cleanBuffer = crmBuffer.subarray(0, idx + endKeyBuf.length);
        const tempBuffer = Buffer.from('\n\n' + tempContent, 'utf8');
        finalBuffer = Buffer.concat([cleanBuffer, tempBuffer]);
    } else {
        // Fallback: Just overwrite completely? No, too risky.
        // Assume file is somehow readable?
        // Let's try writing the temp content ONLY if we fail? No.
        console.error("Could not find end of file marker!");
        process.exit(1);
    }

    fs.writeFileSync(crmPath, finalBuffer);
    console.log('SUCCESS: Repaired crm_logic.js via Buffer slice');

} catch (err) {
    console.error('Error fixing files:', err);
    process.exit(1);
}
