import { AppProvider } from './AppProvider';
import './app.css';
import { AppRoutes } from '@/routes';
import '@mantine/core/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'tailwindcss/tailwind.css';
import { init } from '@neutralinojs/lib';
import { store } from '@/shared/store';
import { setValheimPath } from '@/features/settings/settings.actions.ts';
import { registerEvents } from '@/events.ts';
import { findValheimPath } from '@/utils/find-valheim-path.ts';

registerEvents().then(async () => {
  try {
    init();

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
