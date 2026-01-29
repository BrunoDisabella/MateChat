import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Configure ffmpeg to use the static binary
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Converts audio data (base64) to WhatsApp-compatible OGG/Opus format.
 * This ensures voice notes play correctly on mobile devices.
 * 
 * @param {string} base64Data - The raw base64 audio data
 * @returns {Promise<string>} - The converted audio in base64
 */
export const convertToOpus = async (base64Data) => {
    return new Promise((resolve, reject) => {
        // Ensure inputs are valid
        if (!base64Data || typeof base64Data !== 'string') {
            return reject(new Error('Invalid input: base64Data must be a non-empty string'));
        }

        const tempDir = os.tmpdir();
        const fileId = uuidv4();
        const inputPath = path.join(tempDir, `input_${fileId}.mp3`); // Assume input is likely mp3/wav
        const outputPath = path.join(tempDir, `output_${fileId}.ogg`);

        try {
            // Write input file
            fs.writeFileSync(inputPath, Buffer.from(base64Data, 'base64'));

            ffmpeg(inputPath)
                .audioCodec('libopus')
                .audioBitrate('64k')
                .audioChannels(1) // Mono is crucial for WhatsApp PTT
                .format('ogg')
                .on('end', () => {
                    try {
                        const convertedBase64 = fs.readFileSync(outputPath).toString('base64');
                        cleanupFiles([inputPath, outputPath]);
                        resolve(convertedBase64);
                    } catch (readError) {
                        cleanupFiles([inputPath, outputPath]);
                        reject(new Error(`Failed to read converted file: ${readError.message}`));
                    }
                })
                .on('error', (err) => {
                    console.error('FFmpeg conversion error:', err);
                    cleanupFiles([inputPath, outputPath]);
                    reject(err);
                })
                .save(outputPath);

        } catch (e) {
            cleanupFiles([inputPath, outputPath]);
            reject(e);
        }
    });
};

/**
 * Helper to safely delete temporary files
 * @param {string[]} filePaths 
 */
const cleanupFiles = (filePaths) => {
    filePaths.forEach(filePath => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            console.warn(`[MediaUtils] Failed to delete temp file ${filePath}:`, e.message);
        }
    });
};
