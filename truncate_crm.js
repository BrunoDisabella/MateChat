const fs = require('fs');
// Use hardcoded path to be safe
const path = 'c:\\Users\\Home\\Desktop\\MateChat\\Mi Extension\\crm_logic.js';
try {
    fs.truncateSync(path, 51572);
    console.log('Truncated to 51572 bytes');
} catch (e) {
    console.error(e);
}
