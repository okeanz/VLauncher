// Функции для отправки событий прогресса через WebSocket
import { makeSend } from '../websocket/setup-ws.js';

export function sendProgressEvent(event: string, data: object) {
  const sendEvent = makeSend('extensionToApp');
  sendEvent({
    event,
    data,
  });
}

export function sendOperationStart(
  operation: 'download' | 'extract',
  totalFiles: number,
  totalSize?: number,
) {
  sendProgressEvent('operationStart', {
    operation,
    totalFiles,
    totalSize,
  });
}

export function sendProgressUpdate(
  progress: number,
  currentFile?: string,
  downloadedSize?: number,
  extractedFiles?: number,
) {
  sendProgressEvent('progressUpdate', {
    progress,
    currentFile,
    downloadedSize,
    extractedFiles,
  });
}

export function sendOperationComplete() {
  sendProgressEvent('operationComplete', {});
}

export function sendOperationError(error: string) {
  sendProgressEvent('operationError', { error });
}

