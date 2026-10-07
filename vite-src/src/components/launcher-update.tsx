import { extensions } from '@neutralinojs/lib';
import { useAppDispatch, useAppSelector } from '@/shared/store/types';
import { setLauncherUpdating } from '@/features/progress/progress.slice';

/** Title bar button once a newer launcher is downloaded: the launcher closes and comes back updated. */
export const LauncherUpdate = () => {
  const dispatch = useAppDispatch();
  const p = useAppSelector((s) => s.progress);
  if (!p.launcherUpdate) return null;
  const busy = p.isLoading || p.running || p.launching || p.configuring || p.launcherUpdating;
  const apply = () => {
    dispatch(setLauncherUpdating(true));
    extensions
      .dispatch('fileLoader', 'ApplyLauncherUpdate', { appPid: Number(window.NL_PID) })
      .catch(() => dispatch(setLauncherUpdating(false)));
  };
  return (
    <button
      type="button"
      className="ns-update-button"
      disabled={busy}
      title={`Версия ${p.launcherUpdate}. Лаунчер закроется и откроется заново.`}
      onClick={apply}
    >
      {p.launcherUpdating ? 'Обновляется…' : 'Обновить лаунчер'}
    </button>
  );
};
