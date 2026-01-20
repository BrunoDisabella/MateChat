const fs = require('fs');
const path = require('path');

const crmPath = path.join(process.cwd(), 'Mi Extension', 'crm_logic.js');

try {
    const fd = fs.openSync(crmPath, 'r');
    const buffer = Buffer.alloc(50);
    fs.readSync(fd, buffer, 0, 50, 0);
    fs.closeSync(fd);
    console.log("HEX:", buffer.toString('hex'));
    console.log("STR:", buffer.toString('utf8').replace(/\0/g, '.')); // visualizing nulls
} catch (e) {
    console.error(e);
}
