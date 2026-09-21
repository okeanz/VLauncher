import { useState } from 'react';
import { IconPlayerPlay } from '@tabler/icons-react';
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
} from '@/features/progress/progress.slice';
import { launchValheim } from '@/utils/launch-valheim.ts';
import { isSteamReady, startSteam, waitForSteam } from '@/utils/steam-status.ts';

type SteamPrompt = 'closed' | 'ask' | 'waiting' | 'failed';

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

  return (
    <>
      <Button
        onClick={handleLaunch}
        size="xl"
        disabled={isDisabled}
        leftSection={<IconPlayerPlay size={20} />}
      >
        {progressInfo.running
          ? 'Игра запущена'
          : progressInfo.isLoading
            ? 'Установка модпака...'
            : selectedServerInfo(progressInfo)?.running === false
              ? 'Сервер остановлен'
              : selectedServerInfo(progressInfo)?.releaseId === null
                ? 'На сервере нет модпака'
                : !progressInfo.serverRelease
                  ? 'Нет связи с сервером модпака'
                  : progressInfo.readyPath && releaseOutdated(progressInfo)
                    ? 'Сначала обновите модпак'
                    : 'Запустить Valheim'}
      </Button>
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
              ? 'Steam не ответил за две минуты. Запустите его вручную, войдите в аккаунт и нажмите «Запустить Valheim» ещё раз.'
              : 'Без Steam Valheim зависает на экране загрузки. Запустить Steam и затем игру?'}
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setSteamPrompt('closed')}>
            {steamPrompt === 'failed' ? 'Закрыть' : 'Отмена'}
          </Button>
          {steamPrompt !== 'failed' && (
            <Button onClick={handleStartSteam} loading={steamPrompt === 'waiting'}>
              Запустить Steam
            </Button>
          )}
        </Group>
      </Modal>
    </>
  );
};
