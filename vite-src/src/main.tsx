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
import { init, window as appWindow, debug } from '@neutralinojs/lib';
import { fitWindow } from '@/utils/fit-window';
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
    // Window metrics in neutralinojs.log: what a player with a cut-off window sends.
    const metrics = async (when: string) => {
      const size = await appWindow.getSize().catch(() => null);
      void debug.log(
        `[window ${when}] inner ${innerWidth}x${innerHeight} outer ${outerWidth}x${outerHeight} dpr ${devicePixelRatio} ` +
          `screen ${screen.width}x${screen.height} avail ${screen.availWidth}x${screen.availHeight} ` +
          `zoom '${document.documentElement.style.zoom}' native ${JSON.stringify(size)}`,
      );
    };
    void metrics('start')
      .then(() => fitWindow(window, appWindow))
      .then(() => setTimeout(() => void metrics('fitted'), 1500));

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
