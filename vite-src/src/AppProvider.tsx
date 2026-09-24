import { store } from '@/shared/store';
import { createTheme, MantineColorsTuple, MantineProvider } from '@mantine/core';
import * as React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';

// Кровь Starblood: акцент кнопок, переключателей и выделения (6 — #c8243a).
const blood: MantineColorsTuple = [
  '#ffe9ec',
  '#ffd1d6',
  '#f9a1ab',
  '#f36e7c',
  '#ec4557',
  '#e32b3f',
  '#c8243a',
  '#a91c30',
  '#8d1527',
  '#6f0d1c',
];

// «Северный шторм»: ночная синева вместо серых тёмных тонов Mantine.
const dark: MantineColorsTuple = [
  '#ece6da',
  '#b9c3cf',
  '#9aa8b9',
  '#5f6f84',
  '#2f3f56',
  '#22324a',
  '#152030',
  '#0d141e',
  '#0a0f16',
  '#06090e',
];

const theme = createTheme({
  defaultRadius: 0,
  primaryColor: 'blood',
  primaryShade: 6,
  colors: { blood, dark },
  fontFamily: "'Alegreya Sans', 'Segoe UI', sans-serif",
  fontFamilyMonospace: "'IBM Plex Mono', Consolas, monospace",
  headings: { fontFamily: "'Alegreya SC', Georgia, serif", fontWeight: '900' },
});

function ErrorFallback() {
  return (
    <div role="alert">
      <h2>Ooops, something went wrong :( </h2>
    </div>
  );
}

type AppProviderProps = {
  children: React.ReactNode;
};

export function AppProvider({ children }: AppProviderProps) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <Provider store={store}>
        <MantineProvider theme={theme} forceColorScheme="dark">
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <Router>{children}</Router>
          </ErrorBoundary>
        </MantineProvider>
      </Provider>
    </React.Suspense>
  );
}
