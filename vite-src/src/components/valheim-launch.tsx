import { IconPlayerPlay } from '@tabler/icons-react';
import { Button } from '@mantine/core';
import { useSelector } from 'react-redux';
import {
  valheimPathSelector,
  valheimPathValidSelector,
} from '@/features/settings/settings.slice.ts';
import { progressInfoSelector, canLaunch } from '@/features/progress/progress.slice';
import { launchValheim } from '@/utils/launch-valheim.ts';

export const ValheimLaunch = () => {
  const valheimPath = useSelector(valheimPathSelector);
  const valheimPathValid = useSelector(valheimPathValidSelector);
  const progressInfo = useSelector(progressInfoSelector);

  const handleLaunch = () => launchValheim(valheimPath);

  const isDisabled = !valheimPathValid || !canLaunch(progressInfo, valheimPath);

  return (
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
          : 'Запустить Valheim'}
    </Button>
  );
};
