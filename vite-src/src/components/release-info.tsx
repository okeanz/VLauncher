import { Group, Stack, Text } from '@mantine/core';
import { useAppSelector } from '@/shared/store/types';
import {
  releaseOutdated,
  revisionLabel,
  selectedServerInfo,
} from '@/features/progress/progress.slice';

const date = (value: string | null) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
    : null;
};

export const ReleaseInfo = () => {
  const p = useAppSelector((state) => state.progress);
  const server = p.serverRelease;
  const listed = selectedServerInfo(p);
  const since = date(server?.activatedAt ?? server?.createdAt ?? null);
  const installed = p.readyRelease
    ? revisionLabel(p.readyRelease)
    : p.isLoading
      ? 'обновляется…'
      : 'не установлена';
  return (
    <Stack gap={2} mb="xs">
      <Group gap="xs" wrap="nowrap">
        <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
          Ревизия модпака на сервере:{' '}
          {server
            ? revisionLabel(server.releaseId)
            : listed && listed.releaseId === null
              ? 'не установлена'
              : 'нет связи'}
        </Text>
        {since && (
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            с {since}
          </Text>
        )}
      </Group>
      {server?.title && (
        <Text size="xs" c="dimmed" lineClamp={1} title={server.title}>
          {server.title}
        </Text>
      )}
      <Text size="xs" c={server && !releaseOutdated(p) ? 'green' : 'orange'}>
        Установлена у вас: {installed}
      </Text>
    </Stack>
  );
};
