import { CounterPage } from '@/pages/CounterPage';
import { AppShell, Container } from '@mantine/core';
import { useRoutes } from 'react-router-dom';
import MainPage from '@/pages/main-page.tsx';
import img from '@/assets/background.jpg';

export function AppRoutes() {
  const routes = [
    {
      path: '/',
      element: <MainPage />,
    },
    {
      path: '/counter',
      element: <CounterPage />,
    },
  ];

  const element = useRoutes([...routes]);

  return (
    <AppShell
      padding="md"
      style={{
        backgroundImage: `url("${img}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: '100vh',
      }}
    >
      <AppShell.Main>
        <Container size="md">{element}</Container>
      </AppShell.Main>
    </AppShell>
  );
}
