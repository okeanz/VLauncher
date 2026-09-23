import { Card, Group, Indicator, Select, Text } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/shared/store/types';
import { chooseServer } from '@/shared/actions/choose-server';
import {
  revisionLabel,
  selectedServerInfo,
  serverStatusLabel,
  type LauncherServer,
} from '@/features/progress/progress.slice';

const label = (s: LauncherServer) =>
  [
    s.name,
    s.kind === 'test' ? 'тест' : null,
    serverStatusLabel(s) || null,
    s.releaseId === null ? 'без модпака' : revisionLabel(s.releaseId),
  ]
    .filter(Boolean)
    .join(' · ');

/** Dot next to the server menu: green when the game accepts players, yellow while it loads, red when it is down. */
const indicator = (s: LauncherServer | null) => {
  if (!s) return { color: 'gray', processing: false, title: 'Состояние сервера неизвестно' };
  const status = serverStatusLabel(s);
  if (!status) return { color: 'green', processing: false, title: 'Сервер готов' };
  return {
    color: status === 'запускается' ? 'yellow' : 'red',
    processing: status === 'запускается',
    title: `Сервер ${status}`,
  };
};

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
  const dot = indicator(selectedServerInfo(p));
  return (
    <Card padding="xs" style={{ paddingLeft: '20px' }}>
      <Group gap="xs" wrap="nowrap">
        <Indicator
          color={dot.color}
          position="middle-start"
          processing={dot.processing}
          title={dot.title}
          aria-label={dot.title}
        >
          <Text size="xs" style={{ whiteSpace: 'nowrap', paddingLeft: '15px' }}>
            Сервер:
          </Text>
        </Indicator>
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
