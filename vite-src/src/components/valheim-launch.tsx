import { IconPlayerPlay } from '@tabler/icons-react';
import { Button } from '@mantine/core';
import { useSelector } from 'react-redux';
import {
  valheimPathSelector,
  valheimPathValidSelector,
} from '@/features/settings/settings.slice.ts';
import { launchValheim } from '@/utils/launch-valheim.ts';
import { useFileServerCheck } from '@/hooks/use-file-server-check.ts';

export const ValheimLaunch = () => {
  const valheimPath = useSelector(valheimPathSelector);
  const valheimPathValid = useSelector(valheimPathValidSelector);

  const handleLaunch = () => launchValheim(valheimPath);

  const { isReady } = useFileServerCheck();

  return (
    <Button
      onClick={handleLaunch}
      size="xl"
      disabled={!valheimPathValid || !isReady}
      leftSection={<IconPlayerPlay size={20} />}
    >
      Запустить Valheim
    </Button>
  );
};
