import fs from 'fs';
import path from 'node:path';

const logPath = path.join(__dirname, './log.txt');

const cleanUpFileLog = () => {
  try {
    fs.rmSync(logPath);
  } catch {
    /* empty */
  }
};

cleanUpFileLog();

export function logInfo(message: string, type = 'INFO') {
  fs.appendFileSync(logPath, `\n${new Date().toUTCString()}-[${type}] ${message}`);
  console.log(`${new Date().toUTCString()}-[${type}] ${message}`);
}
