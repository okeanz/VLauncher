import { useFileServerCheck } from '@/hooks/use-file-server-check';
import { useAppSelector } from '@/shared/store/types';

/** File server reachability, shown in the title bar; on failure the reason shows on hover. */
export const ServerCheck = () => {
  const status = useFileServerCheck();
  const reason = useAppSelector((s) => s.progress.serverListError);
  const hint =
    !status.isReady && reason
      ? `${reason}\nЖурнал: %LOCALAPPDATA%\\VLauncher\\launcher.log`
      : undefined;
  return (
    <div className="ns-status" title={hint}>
      <span
        className="ns-dot"
        style={{ color: status.isReady ? 'var(--ns-ok)' : 'var(--ns-bad)' }}
      />
      <span>Файл-сервер {status.name.toLowerCase()}</span>
    </div>
  );
};
