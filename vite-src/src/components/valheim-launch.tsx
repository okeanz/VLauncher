import { IconPlayerPlay } from '@tabler/icons-react';
import { Button } from '@mantine/core';
import { useSelector } from 'react-redux';
import {
  valheimPathSelector,
  valheimPathValidSelector,
} from '@/features/settings/settings.slice.ts';
import { progressInfoSelector } from '@/features/progress/progress.slice';
import { launchValheim } from '@/utils/launch-valheim.ts';
import { useFileServerCheck } from '@/hooks/use-file-server-check.ts';

export const ValheimLaunch = () => {
  const valheimPath = useSelector(valheimPathSelector);
  const valheimPathValid = useSelector(valheimPathValidSelector);
  const progressInfo = useSelector(progressInfoSelector);

  const handleLaunch = () => launchValheim(valheimPath);

  const { isReady } = useFileServerCheck();

  const isDisabled = !valheimPathValid || !isReady || progressInfo.isLoading;

  return (
    <Button
      onClick={handleLaunch}
      size="xl"
      disabled={isDisabled}
      leftSection={<IconPlayerPlay size={20} />}
    >
      {progressInfo.isLoading ? 'Загрузка файлов...' : 'Запустить Valheim'}
    </Button>
  );
};
