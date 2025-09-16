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
import { log } from '@/utils/log.ts';
import { store } from '@/shared/store';
import { setValheimPath } from '@/features/settings/settings.slice.ts';

init();

events.on('windowClose', () => app.exit());

const start = async () => {
  const steamPath = await getSteamPath();
  log(steamPath);
  const gamePath = await getValheimPath(steamPath);
  log(gamePath);
  return gamePath;
};

start().then((res) => {
  store.dispatch(setValheimPath(res));
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </StrictMode>,
  );
});
