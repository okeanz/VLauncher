import { useState } from 'react';
import { Button, Group, Modal, Text } from '@mantine/core';
import { useSelector } from 'react-redux';
import {
  valheimPathSelector,
  valheimPathValidSelector,
} from '@/features/settings/settings.slice.ts';
import {
  progressInfoSelector,
  canLaunch,
  releaseOutdated,
  selectedServerInfo,
  serverStatusLabel,
  type ProgressState,
} from '@/features/progress/progress.slice';
import { launchValheim } from '@/utils/launch-valheim.ts';
import { isSteamReady, startSteam, waitForSteam } from '@/utils/steam-status.ts';
import axe from '@/assets/north-storm/axe-glyph.svg';

type SteamPrompt = 'closed' | 'ask' | 'waiting' | 'failed';

/**
 * What the big button says. `label` is its accessible name (and the old button text);
 * `title`/`sub` are what the player sees; `tone` picks the look.
 */
type Face = { label: string; title: string; sub?: string; tone: 'go' | 'wait' | 'off' };
const launchFace = (p: ProgressState, pathValid: boolean): Face => {
  const server = selectedServerInfo(p);
  const status = server ? serverStatusLabel(server) : '';
  if (p.running)
    return { label: 'Игра запущена', title: 'Игра запущена', sub: 'Удачного похода', tone: 'off' };
  if (p.launching)
    return {
      label: 'Запускаем Valheim…',
      title: 'Запускаем',
      sub: 'Игра откроется через пару секунд',
      tone: 'wait',
    };
  if (p.isLoading)
    return {
      label: 'Установка модпака...',
      title: 'Установка',
      sub: 'Кнопка включится после проверки',
      tone: 'off',
    };
  if (status === 'запускается')
    return {
      label: 'Сервер запускается…',
      title: 'Сервер запускается',
      sub: 'Кнопка включится сама',
      tone: 'wait',
    };
  if (status)
    return {
      label: `Сервер ${status}`,
      title: `Сервер ${status}`,
      sub: 'Попробуйте позже',
      tone: 'off',
    };
  if (server?.releaseId === null)
    return {
      label: 'На сервере нет модпака',
      title: 'Нет модпака',
      sub: 'На сервере пока нет модпака',
      tone: 'off',
    };
  if (!pathValid)
    return {
      label: 'Укажите папку Valheim',
      title: 'Нет игры',
      sub: 'Укажите папку Valheim',
      tone: 'off',
    };
  if (!p.serverRelease)
    return {
      label: 'Нет связи с сервером модпака',
      title: 'Нет связи',
      sub: 'Сервер модпака не отвечает',
      tone: 'off',
    };
  if (p.readyPath && releaseOutdated(p))
    return {
      label: 'Сначала обновите модпак',
      title: 'Обновите',
      sub: 'Сначала обновите модпак',
      tone: 'off',
    };
  return { label: 'Запустить Valheim', title: 'В бой', tone: 'go' };
};

const Spinner = () => (
  <svg className="ns-spinner" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="#5a4718" strokeWidth="3" />
    <path d="M12 3 A9 9 0 0 1 21 12" fill="none" stroke="currentColor" strokeWidth="3" />
  </svg>
);

export const ValheimLaunch = () => {
  const valheimPath = useSelector(valheimPathSelector);
  const valheimPathValid = useSelector(valheimPathValidSelector);
  const progressInfo = useSelector(progressInfoSelector);

  const [steamPrompt, setSteamPrompt] = useState<SteamPrompt>('closed');

  const handleLaunch = async () => {
    if (await isSteamReady()) await launchValheim(valheimPath);
    else setSteamPrompt('ask');
  };
  const handleStartSteam = async () => {
    setSteamPrompt('waiting');
    try {
      await startSteam();
      if (!(await waitForSteam())) return setSteamPrompt('failed');
      setSteamPrompt('closed');
      await launchValheim(valheimPath);
    } catch {
      setSteamPrompt('failed');
    }
  };

  const isDisabled = !valheimPathValid || !canLaunch(progressInfo, valheimPath);
  const face = launchFace(progressInfo, valheimPathValid);

  return (
    <>
      <button
        type="button"
        className={`ns-play ns-play--${face.tone}`}
        onClick={handleLaunch}
        disabled={isDisabled}
        aria-label={face.label}
      >
        {/* A border would be cut by the slanted clip-path, so the edge is drawn along it. */}
        <svg className="ns-play-edge" viewBox="0 0 310 96" aria-hidden="true">
          <polygon points="29,1.5 308,1.5 281,94.5 2,94.5" />
        </svg>
        {face.tone === 'go' ? (
          <>
            <img src={axe} alt="" width={40} height={40} />
            <span className="ns-play-title">{face.title}</span>
            <span className="ns-play-rivet" style={{ left: 36, top: 12 }} />
            <span className="ns-play-rivet" style={{ right: 36, bottom: 12 }} />
          </>
        ) : (
          <>
            {face.tone === 'wait' && <Spinner />}
            <span className="ns-play-text">
              <span className="ns-play-title">{face.title}</span>
              {face.sub && <span className="ns-play-sub">{face.sub}</span>}
            </span>
          </>
        )}
      </button>
      <Modal
        opened={steamPrompt !== 'closed'}
        onClose={() => setSteamPrompt('closed')}
        closeOnClickOutside={steamPrompt !== 'waiting'}
        title="Steam не запущен"
        centered
      >
        <Text size="sm">
          {steamPrompt === 'waiting'
            ? 'Запускаем Steam и ждём входа в аккаунт. Игра стартует сама.'
            : steamPrompt === 'failed'
              ? 'Steam не ответил за две минуты. Запустите его вручную, войдите в аккаунт и нажмите «В бой» ещё раз.'
              : 'Без Steam Valheim зависает на экране загрузки. Запустить Steam и затем игру?'}
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setSteamPrompt('closed')}>
            {steamPrompt === 'failed' ? 'Закрыть' : 'Отмена'}
          </Button>
          {steamPrompt !== 'failed' && (
            <Button color="#c8243a" onClick={handleStartSteam} loading={steamPrompt === 'waiting'}>
              Запустить Steam
            </Button>
          )}
        </Group>
      </Modal>
    </>
  );
};
