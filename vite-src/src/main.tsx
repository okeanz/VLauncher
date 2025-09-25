import { AppProvider } from './AppProvider';
import './app.css';
import { AppRoutes } from '@/routes';
import '@mantine/core/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'tailwindcss/tailwind.css';
import { init } from '@neutralinojs/lib';
import { getSteamPath } from '@/utils/get-steam-path.ts';
import { getValheimPath } from '@/utils/get-valheim-path.ts';
import { logInfo, logError } from '@/utils/logInfo.ts';
import { store } from '@/shared/store';
import { setValheimPath } from '@/features/settings/settings.actions.ts';
import { getStorageGamePath } from '@/utils/get-storage-game-path.ts';
import { registerEvents } from '@/events.ts';

init();

const start = async () => {
  try {
    await registerEvents();

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

start().then(async (res) => {
  logInfo('Start finished');
  store.dispatch(setValheimPath(res));

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </StrictMode>,
  );
}, () => {
  logInfo('Start failed');
});
