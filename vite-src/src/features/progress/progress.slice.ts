import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
export const initialState = {
  isLoading: false,
  readyPath: '',
  requestedPath: '',
  running: false,
  configuring: false,
  launching: false,
  connected: false,
  currentFile: '',
  error: null as string | null,
};
export type ProgressState = typeof initialState;
export const canLaunch = (state: ProgressState, game: string) =>
  Boolean(
    game &&
      state.connected &&
      state.readyPath === game &&
      !state.isLoading &&
      !state.running &&
      !state.launching &&
      !state.configuring &&
      !state.error,
  );
export const progressSlice = createSlice({
  name: 'progress',
  initialState,
  reducers: {
    beginInstall(state, action: PayloadAction<string>) {
      state.isLoading = true;
      state.readyPath = '';
      state.requestedPath = action.payload;
      state.error = null;
      state.currentFile = 'Проверка релиза';
    },
    installReady(state, action: PayloadAction<string>) {
      if (state.isLoading && state.requestedPath === action.payload) {
        state.isLoading = false;
        state.readyPath = action.payload;
        state.currentFile = '';
      }
    },
    updateProgress(state, action: PayloadAction<string>) {
      if (state.isLoading) state.currentFile = action.payload;
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.readyPath = '';
      state.isLoading = false;
      state.launching = false;
      state.configuring = false;
    },
    clearError(state) {
      state.error = null;
    },
    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
      if (!action.payload) {
        state.readyPath = '';
        state.isLoading = false;
        state.launching = false;
        state.configuring = false;
        state.error = 'Соединение с установщиком потеряно. Перезапустите лаунчер.';
      }
    },
    setRunning(state, action: PayloadAction<boolean>) {
      state.running = action.payload;
      state.launching = false;
    },
    setLaunching(state, action: PayloadAction<boolean>) {
      state.launching = action.payload;
    },
    setConfiguring(state, action: PayloadAction<boolean>) {
      state.configuring = action.payload;
    },
    resetProgress: (state) => ({ ...initialState, connected: state.connected }),
  },
  selectors: { progressInfoSelector: (state) => state },
});
export const {
  beginInstall,
  installReady,
  updateProgress,
  setError,
  clearError,
  setConnected,
  setRunning,
  setLaunching,
  setConfiguring,
  resetProgress,
} = progressSlice.actions;
export const { progressInfoSelector } = progressSlice.selectors;
