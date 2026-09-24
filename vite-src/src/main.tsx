import { AppProvider } from './AppProvider';
import './app.css';
import { AppRoutes } from '@/routes';
import '@mantine/core/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'tailwindcss/tailwind.css';
import '@fontsource/alegreya-sc/700.css';
import '@fontsource/alegreya-sc/900.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './north-storm.css';
import { init } from '@neutralinojs/lib';
import { store } from '@/shared/store';
import { setValheimPath } from '@/features/settings/settings.actions.ts';
import { registerEvents } from '@/events.ts';
import { findValheimPath } from '@/utils/find-valheim-path.ts';
import { selectServer } from '@/features/progress/progress.slice';
import { storedServer } from '@/shared/actions/choose-server';
import { serverPicker } from '@/constants/build';

registerEvents().then(async () => {
  try {
    init();

    // Players always play on the main server; only admin builds remember another one.
    store.dispatch(selectServer(serverPicker ? await storedServer() : 'main'));
    const valheimPath = await findValheimPath();

    store.dispatch(setValheimPath(valheimPath));

    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </StrictMode>,
    );
  } catch (e) {
    console.error(e);
  }
});
