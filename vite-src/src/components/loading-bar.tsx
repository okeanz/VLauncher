import { IconAlertTriangle, IconCheck, IconDownload, IconRefresh } from '@tabler/icons-react';
import { useAppDispatch, useAppSelector } from '@/shared/store/types';
import { loadArchives } from '@/shared/actions/load-archives';
import { releaseOutdated, revisionLabel } from '@/features/progress/progress.slice';
import { useChooseFolder } from '@/hooks/use-choose-folder';

const date = (value: string | null) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
    : null;
};

type Tone = 'ok' | 'warn' | 'bad' | 'muted';
const icons = { ok: IconCheck, warn: IconDownload, bad: IconAlertTriangle, muted: IconRefresh };

/** The modpack card of the dock: server revision, what the player has and the update check. */
export const LoadingBar = () => {
  const dispatch = useAppDispatch();
  const p = useAppSelector((state) => state.progress);
  const settings = useAppSelector((state) => state.settings);
  const chooseFolder = useChooseFolder();
  if (!settings.valheimPathValid)
    return (
      <div className="ns-release">
        <div className="ns-label">модпак</div>
        <div className="ns-release-status ns-tone-warn">
          <IconAlertTriangle size={16} stroke={2} />
          <span>
            {settings.valheimPath
              ? 'В выбранной папке нет valheim.exe'
              : 'Не найдена папка с установленным Valheim'}
          </span>
        </div>
        <div className="ns-release-row">
          <button
            type="button"
            className="ns-link-button"
            disabled={chooseFolder.busy}
            onClick={chooseFolder.open}
          >
            Указать папку Valheim
          </button>
        </div>
      </div>
    );
  const server = p.serverRelease;
  const since = date(server?.activatedAt ?? server?.createdAt ?? null);
  const outdated = Boolean(p.readyPath) && releaseOutdated(p);
  const [tone, message]: [Tone, string] = p.error
    ? ['bad', p.error]
    : p.isLoading
      ? ['warn', server ? `Ставим ${server.releaseId}` : 'Ставим модпак']
      : outdated
        ? [
            'warn',
            `На сервере новая ревизия, у вас ${p.readyRelease ? revisionLabel(p.readyRelease) : 'старая'}`,
          ]
        : p.readyPath && server
          ? ['ok', 'Совпадает с сервером']
          : p.readyPath
            ? ['warn', 'Нет связи с сервером, ревизию не проверить']
            : p.connected
              ? ['muted', 'Модпак ещё не проверен']
              : ['muted', 'Подключение к установщику…'];
  const Icon = icons[tone];
  const busy = !p.connected || p.isLoading || p.running || p.launching || p.configuring;
  return (
    <div className="ns-release">
      <div className="ns-label">модпак</div>
      {!p.isLoading && (
        <>
          <div className="ns-release-id" title={server?.releaseId}>
            {server ? server.releaseId : 'Ревизия сервера неизвестна'}
          </div>
          {since && <div className="ns-release-since">На сервере с {since}</div>}
        </>
      )}
      <div className="ns-release-row">
        <div className={`ns-release-status ns-tone-${tone}`}>
          <Icon size={16} stroke={2} style={{ flexShrink: 0 }} />
          <span title={message}>{message}</span>
        </div>
        <button
          type="button"
          className="ns-link-button"
          disabled={busy}
          onClick={() => dispatch(loadArchives(settings.valheimPath))}
        >
          <IconRefresh size={14} stroke={2} />
          Проверить обновления
        </button>
      </div>
      {p.isLoading && (
        <div className="ns-release-file" title={p.currentFile}>
          {p.currentFile}
        </div>
      )}
    </div>
  );
};
