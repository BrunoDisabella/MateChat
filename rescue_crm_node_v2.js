const fs = require('fs');
const path = require('path');

const crmPath = path.join(process.cwd(), 'Mi Extension', 'crm_logic.js');
const tempPath = path.join(process.cwd(), 'Mi Extension', 'temp_config_module.js');

try {
    const crmBuffer = fs.readFileSync(crmPath);
    console.log(`Original size: ${crmBuffer.length}`);

    // Try finding the last known valid line start
    const anchor = Buffer.from('const arranque = setInterval');
    const idx = crmBuffer.lastIndexOf(anchor);

    if (idx !== -1) {
        console.log(`Found anchor at ${idx}`);
        // Find the next newline or end of file
        let endIdx = crmBuffer.indexOf('\n', idx);
        if (endIdx === -1) endIdx = crmBuffer.length;

        console.log(`Truncating at ${endIdx}`);

        const cleanBuffer = crmBuffer.subarray(0, endIdx);
        const tempContent = fs.readFileSync(tempPath, 'utf8');
        const tempBuffer = Buffer.from('\n\n' + tempContent, 'utf8');

        const finalBuffer = Buffer.concat([cleanBuffer, tempBuffer]);

        fs.writeFileSync(crmPath, finalBuffer);
        console.log(`Success! New size: ${finalBuffer.length}`);
    } else {
        console.error("Could not find anchor 'const arranque = setInterval'");
        process.exit(1);
    }
} catch (err) {
    console.error(err);
    process.exit(1);
}
