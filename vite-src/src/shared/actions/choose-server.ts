import { createAsyncThunk } from '@reduxjs/toolkit';
import { extensions, storage } from '@neutralinojs/lib';
import { serverKey } from '@/constants/storage-keys';
import { selectServer, type ProgressState } from '@/features/progress/progress.slice';
import { loadArchives } from '@/shared/actions/load-archives';

type State = {
  progress: ProgressState;
  settings: { valheimPath: string; valheimPathValid: boolean };
};

/** Switches the target server: remembers it, points the extension's poll at it and installs its modpack. */
export const chooseServer = createAsyncThunk(
  'app/chooseServer',
  async (serverId: string, { dispatch, getState }) => {
    dispatch(selectServer(serverId));
    try {
      await storage.setData(serverKey, serverId);
    } catch {
      // Remembering the choice is a convenience; the switch itself still applies.
    }
    try {
      await extensions.dispatch('fileLoader', 'SelectServer', { serverId });
    } catch {
      // Installation and launch carry the server id explicitly.
    }
    const { settings } = getState() as State;
    if (settings.valheimPathValid) await dispatch(loadArchives(settings.valheimPath));
  },
  {
    condition: (serverId, { getState }) => {
      const { progress } = getState() as State;
      return (
        serverId !== progress.selectedServer &&
        !progress.isLoading &&
        !progress.running &&
        !progress.launching &&
        !progress.configuring
      );
    },
  },
);

export async function storedServer() {
  try {
    const value = await storage.getData(serverKey);
    return /^(main|[a-f0-9-]{36})$/.test(value) ? value : 'main';
  } catch {
    return 'main';
  }
}
