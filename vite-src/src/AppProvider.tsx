import { store } from '@/shared/store';
import { createTheme, MantineColorsTuple, MantineProvider } from '@mantine/core';
import * as React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Provider } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';

const primary: MantineColorsTuple = [
  '#0f1b2b', // тёмно-синий для акцентов
  '#1c2a42',
  '#2a3a5c',
  '#3b4d7a',
  '#4d6199',
  '#5f76b5',
  '#718bce',
  '#8aa6e0',
  '#a3c1f2',
  '#c0d8ff', // светлый ледяной акцент
];

const theme = createTheme({
  defaultRadius: 'md',
  primaryColor: 'primary',
  colors: {
    primary,
  },
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
        <MantineProvider theme={theme}>
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <Router>{children}</Router>
          </ErrorBoundary>
        </MantineProvider>
      </Provider>
    </React.Suspense>
  );
}
