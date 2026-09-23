import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
export type ServerRelease = {
  releaseId: string;
  title: string | null;
  gameVersion: string | null;
  createdAt: string | null;
  activatedAt: string | null;
};
export type ServerState = 'ready' | 'starting' | 'preparing' | 'stopped' | 'failed' | 'unavailable';
export type LauncherServer = {
  id: string;
  kind: 'main' | 'test';
  name: string;
  address: string | null;
  running: boolean | null;
  /** Missing or null from a panel that predates readiness reporting: running decides then. */
  state?: ServerState | null;
  releaseId: string | null;
};
/** The game on the server accepts players; an unlisted server is not held back. */
export const serverReady = (s: LauncherServer | null) =>
  s === null || (s.state ? s.state === 'ready' : s.running !== false);
/** Short status for the server menu and the launch button; empty when the server is ready. */
export const serverStatusLabel = (s: LauncherServer): string => {
  if (s.state === 'starting' || s.state === 'preparing') return 'запускается';
  if (s.state === 'failed' || s.state === 'unavailable') return 'не отвечает';
  if (s.state === 'stopped' || (!s.state && s.running === false)) return 'остановлен';
  return '';
};
export const initialState = {
  isLoading: false,
  readyPath: '',
  readyRelease: '',
  /** Revision currently published by the server; null while unknown or unreachable. */
  serverRelease: null as ServerRelease | null,
  /** Servers published by the panel; null until the first successful poll. */
  servers: null as LauncherServer[] | null,
  selectedServer: 'main',
  readyServer: '',
  requestedPath: '',
  running: false,
  configuring: false,
  launching: false,
  connected: false,
  currentFile: '',
  error: null as string | null,
};
export type ProgressState = typeof initialState;
export const selectedServerInfo = (state: ProgressState): LauncherServer | null => {
  const listed = state.servers?.find((s) => s.id === state.selectedServer) ?? null;
  // The manifest is authoritative: an older panel lists the main server without its release.
  return listed && state.serverRelease
    ? { ...listed, releaseId: state.serverRelease.releaseId }
    : listed;
};
export const canLaunch = (state: ProgressState, game: string) =>
  Boolean(
    game &&
      state.connected &&
      state.readyPath === game &&
      state.readyServer === state.selectedServer &&
      serverReady(selectedServerInfo(state)) &&
      state.serverRelease !== null &&
      state.readyRelease === state.serverRelease.releaseId &&
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
      state.readyRelease = '';
      state.readyServer = '';
      state.requestedPath = action.payload;
      state.error = null;
      state.currentFile = 'Проверка релиза';
    },
    installReady: {
      reducer(
        state,
        action: PayloadAction<{ gamePath: string; releaseId: string; serverId: string }>,
      ) {
        if (state.isLoading && state.requestedPath === action.payload.gamePath) {
          state.isLoading = false;
          state.currentFile = '';
          // An installation for a server the player has since switched away from is not readiness.
          if (action.payload.serverId !== state.selectedServer) return;
          state.readyPath = action.payload.gamePath;
          state.readyRelease = action.payload.releaseId;
          state.readyServer = action.payload.serverId;
        }
      },
      prepare: (gamePath: string, releaseId: string, serverId = 'main') => ({
        payload: { gamePath, releaseId, serverId },
      }),
    },
    setServers(state, action: PayloadAction<LauncherServer[] | null>) {
      state.servers = action.payload;
    },
    selectServer(state, action: PayloadAction<string>) {
      if (state.selectedServer === action.payload) return;
      state.selectedServer = action.payload;
      state.serverRelease = null;
      state.readyPath = '';
      state.readyRelease = '';
      state.readyServer = '';
    },
    setServerRelease(state, action: PayloadAction<ServerRelease | null>) {
      state.serverRelease = action.payload;
    },
    updateProgress(state, action: PayloadAction<string>) {
      if (state.isLoading) state.currentFile = action.payload;
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.readyPath = '';
      state.readyRelease = '';
      state.readyServer = '';
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
        state.readyRelease = '';
        state.readyServer = '';
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
    resetProgress: (state) => ({
      ...initialState,
      connected: state.connected,
      serverRelease: state.serverRelease,
      servers: state.servers,
      selectedServer: state.selectedServer,
    }),
  },
  selectors: { progressInfoSelector: (state) => state },
});
export const {
  beginInstall,
  installReady,
  setServerRelease,
  setServers,
  selectServer,
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

/**
 * Short revision label that keeps the modpack line: `localmods-1-0-12-r8` becomes `localmods r8`.
 * Revision numbers are counted per line, so `r8` alone can mean two different modpacks.
 */
export const revisionLabel = (releaseId: string) => {
  const m = /^(.+?)-\d+(?:-\d+)*-(r\d+)$/.exec(releaseId);
  return m ? `${m[1]} ${m[2]}` : releaseId;
};
export const releaseOutdated = (state: ProgressState) =>
  state.serverRelease !== null && state.readyRelease !== state.serverRelease.releaseId;
