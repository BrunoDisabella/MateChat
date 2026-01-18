
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'api-debug.log');

export const logApi = (message, data = null) => {
    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] ${message}`;

    if (data) {
        if (data instanceof Error) {
            logEntry += `\nERROR STACK: ${data.stack}`;
        } else {
            try {
                logEntry += `\nDATA: ${JSON.stringify(data, null, 2)}`;
            } catch (e) {
                logEntry += `\nDATA: [Circular or non-serializable]`;
            }
        }
    }

    logEntry += '\n----------------------------------------\n';

    try {
        fs.appendFileSync(LOG_FILE, logEntry);
    } catch (e) {
        console.error('Failed to write to API log file:', e);
    }
};
