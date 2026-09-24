import { useRoutes } from 'react-router-dom';
import MainPage from '@/pages/main-page.tsx';

export function AppRoutes() {
  return useRoutes([{ path: '*', element: <MainPage /> }]);
}
