import { Card, Text, Button, Loader, Group } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/shared/store/types';
import { loadArchives } from '@/shared/actions/load-archives';
export const LoadingBar = () => {
  const dispatch = useAppDispatch();
  const p = useAppSelector((state) => state.progress);
  const settings = useAppSelector((state) => state.settings);
  if (!settings.valheimPathValid) return null;
  return (
    <Card withBorder>
      <Group>
        {p.isLoading && <Loader size="sm" />}
        <Text c={p.error ? 'red' : undefined}>
          {p.error ||
            (p.isLoading
              ? p.currentFile
              : p.readyPath
                ? 'Модпак проверен и установлен'
                : p.connected
                  ? 'Модпак ещё не проверен'
                  : 'Подключение к установщику…')}
        </Text>
      </Group>
      <Button
        mt="sm"
        variant="light"
        disabled={!p.connected || p.isLoading || p.running || p.launching || p.configuring}
        onClick={() => dispatch(loadArchives(settings.valheimPath))}
      >
        Проверить обновления
      </Button>
    </Card>
  );
};
