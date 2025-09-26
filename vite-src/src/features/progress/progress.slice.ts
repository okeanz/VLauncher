import { createSlice } from '@reduxjs/toolkit';

export type ProgressState = {
  isLoading: boolean;
  progress: number;
  currentFile: string;
  totalFiles: number;
  operation: 'download' | 'extract' | 'idle';
  downloadedSize: number;
  totalSize: number;
  extractedFiles: number;
  error: string | null;
};

export const initialState: ProgressState = {
  isLoading: false,
  progress: 0,
  currentFile: '',
  totalFiles: 0,
  operation: 'idle',
  downloadedSize: 0,
  totalSize: 0,
  extractedFiles: 0,
  error: null,
};

export const progressSlice = createSlice({
  name: 'progress',
  initialState,
  reducers: {
    startOperation: (state, action) => {
      const { operation, totalFiles, totalSize } = action.payload;
      state.isLoading = true;
      state.operation = operation;
      state.progress = 0;
      state.totalFiles = totalFiles || 0;
      state.totalSize = totalSize || 0;
      state.downloadedSize = 0;
      state.extractedFiles = 0;
      state.error = null;
    },
    updateProgress: (state, action) => {
      const { progress, currentFile, downloadedSize, extractedFiles } = action.payload;
      state.progress = Math.min(100, Math.max(0, progress));
      if (currentFile) state.currentFile = currentFile;
      if (downloadedSize !== undefined) state.downloadedSize = downloadedSize;
      if (extractedFiles !== undefined) state.extractedFiles = extractedFiles;
    },
    completeOperation: (state) => {
      state.isLoading = false;
      state.progress = 100;
      state.operation = 'idle';
      state.currentFile = '';
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    resetProgress: () => {
      return { ...initialState };
    },
  },
  selectors: {
    progressInfoSelector: (state) => state,
  },
});

export const {
  startOperation,
  updateProgress,
  completeOperation,
  setError,
  clearError,
  resetProgress,
} = progressSlice.actions;

export const {
  progressInfoSelector,
} = progressSlice.selectors;
