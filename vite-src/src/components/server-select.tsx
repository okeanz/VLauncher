import { Card, Group, Select, Text } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/shared/store/types';
import { chooseServer } from '@/shared/actions/choose-server';
import type { LauncherServer } from '@/features/progress/progress.slice';

const label = (s: LauncherServer) =>
  [
    s.name,
    s.kind === 'test' ? 'тест' : null,
    s.running === false ? 'остановлен' : null,
    s.releaseId === null ? 'без модпака' : null,
  ]
    .filter(Boolean)
    .join(' · ');

export const ServerSelect = () => {
  const dispatch = useAppDispatch();
  const p = useAppSelector((state) => state.progress);
  const busy = p.isLoading || p.running || p.launching || p.configuring;
  const servers = (p.servers ?? []).map((s) =>
    s.id === p.selectedServer && p.serverRelease
      ? { ...s, releaseId: p.serverRelease.releaseId }
      : s,
  );
  // Keep the remembered choice visible even before the first list arrives.
  const data = servers.some((s) => s.id === p.selectedServer)
    ? servers.map((s) => ({ value: s.id, label: label(s) }))
    : [
        {
          value: p.selectedServer,
          label: p.selectedServer === 'main' ? 'Основной сервер' : 'Загрузка списка…',
        },
        ...servers.map((s) => ({ value: s.id, label: label(s) })),
      ];
  return (
    <Card padding="xs" style={{ paddingLeft: '16px' }}>
      <Group gap="xs" wrap="nowrap">
        <Text size="xs" style={{ whiteSpace: 'nowrap' }}>
          Сервер:
        </Text>
        <Select
          aria-label="Сервер"
          size="xs"
          w={280}
          data={data}
          value={p.selectedServer}
          allowDeselect={false}
          disabled={busy || servers.length < 2}
          onChange={(value) => {
            if (value) void dispatch(chooseServer(value));
          }}
        />
      </Group>
    </Card>
  );
};
