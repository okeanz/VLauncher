import { AppProvider } from './AppProvider';
import './app.css';
import { AppRoutes } from '@/routes';
import '@mantine/core/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'tailwindcss/tailwind.css';
import { app, init, events } from '@neutralinojs/lib';
import { getSteamPath } from '@/utils/get-steam-path.ts';
import { getValheimPath } from '@/utils/get-valheim-path.ts';
import { logInfo, logError } from '@/utils/logInfo.ts';
import { store } from '@/shared/store';
import { setValheimPath } from '@/features/settings/settings.actions.ts';
import { getStorageGamePath } from '@/utils/get-storage-game-path.ts';
import { loadArchives } from '@/shared/actions/load-archives.ts';

init();

events.on('windowClose', () => app.exit());

const start = async () => {
  try {
    const storageGamePath = await getStorageGamePath();
    if (storageGamePath) {
      return storageGamePath;
    }

    const steamPath = await getSteamPath();
    logInfo(steamPath);
    const gamePath = await getValheimPath(steamPath);
    logInfo(gamePath);
    return gamePath;
  } catch (error) {
    logError(error);
    return '';
  }
};

start().then((res) => {
  store.dispatch(setValheimPath(res));
  store.dispatch(loadArchives());

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </StrictMode>,
  );
});
