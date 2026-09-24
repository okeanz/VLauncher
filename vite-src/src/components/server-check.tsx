import { useFileServerCheck } from '@/hooks/use-file-server-check';

/** File server reachability, shown in the title bar. */
export const ServerCheck = () => {
  const status = useFileServerCheck();
  return (
    <div className="ns-status">
      <span
        className="ns-dot"
        style={{ color: status.isReady ? 'var(--ns-ok)' : 'var(--ns-bad)' }}
      />
      <span>Файл-сервер {status.name.toLowerCase()}</span>
    </div>
  );
};
