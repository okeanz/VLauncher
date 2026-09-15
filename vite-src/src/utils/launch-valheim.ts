import { extensions } from '@neutralinojs/lib';
import { store } from '@/shared/store';
import { canLaunch, setLaunching, setError } from '@/features/progress/progress.slice';
export async function launchValheim(valheimPath: string) {
  if (!canLaunch(store.getState().progress, valheimPath)) return;
  store.dispatch(setLaunching(true));
  try {
    await extensions.dispatch('fileLoader', 'LaunchGame', { valheimPath });
  } catch {
    store.dispatch(setError('Не удалось отправить команду запуска'));
  }
}
