import fs from 'fs';
import path from 'node:path';
import {makeSend} from "./setup-ws.js";

const logPath = path.join(__dirname, './log.txt');

const cleanUpFileLog = () => {
  try {
    fs.rmSync(logPath);
  } catch {
    /* empty */
  }
};

cleanUpFileLog();


export function logInfo(message: string | object, second?: object | string) {
  const sendLog = makeSend('log');

  const msg = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
  const msgSecond = typeof second === 'string' ? second : JSON.stringify(second, null, 2);

  const toLog = `\n${new Date().toUTCString()} - [INFO] ${msg} ${msgSecond ? `\n${msgSecond}` : ''}`;

  fs.appendFileSync(logPath, toLog);
  console.log(toLog);
  sendLog(toLog);
}

export function logError(e: unknown) {
  if (e instanceof Error) {
    logInfo(`${new Date().toUTCString()}-[INFO] - Error ${e.message}\n${e.stack}`);
  } else {
    logInfo(`${new Date().toUTCString()}-[INFO] - Unknown error`);
    logInfo(JSON.stringify(e));
  }
}
