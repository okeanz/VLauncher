import { extensions } from '@neutralinojs/lib';
import { store } from '@/shared/store';
import { canLaunch, setLaunching, setError } from '@/features/progress/progress.slice';
export async function launchValheim(valheimPath: string) {
  const progress = store.getState().progress;
  if (!canLaunch(progress, valheimPath)) return;
  store.dispatch(setLaunching(true));
  try {
    await extensions.dispatch('fileLoader', 'LaunchGame', {
      valheimPath,
      serverId: progress.selectedServer,
    });
  } catch {
    store.dispatch(setError('Не удалось отправить команду запуска'));
  }
}
