import { Card, Group, Indicator, Text } from '@mantine/core';
import { useFileServerCheck } from '@/hooks/use-file-server-check';

export const ServerCheck = () => {
  const status = useFileServerCheck();

  return (
    <Group>
      <Card padding="xs" style={{ paddingLeft: '20px' }}>
        <Indicator color={status.color} position="middle-start" processing={status.isReady}>
          <Text size="xs" style={{ paddingLeft: '15px' }}>
            Файл-сервер: {status.name}
          </Text>
        </Indicator>
      </Card>
    </Group>
  );
};
