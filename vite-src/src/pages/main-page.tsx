import { Button, Card, Text, Container, Stack, Center } from '@mantine/core';
import { IconPlayerPlay } from '@tabler/icons-react';
import { useSelector } from 'react-redux';
import { valheimPathSelector } from '@/features/settings/settings.slice.ts';
import { launchValheim } from '@/utils/launch-valheim.ts';

export default function MainPage() {
  const valheimPath = useSelector(valheimPathSelector);

  const handleLaunch = () => valheimPath && launchValheim(valheimPath);

  return (
    <Container size="md" py="md" h="90vh" style={{ justifyContent: 'flex-end' }}>
      <Stack gap="lg" h="90vh" justify="flex-end">
        {/* Прогресс-бар */}
        {/*<Card shadow="sm" p="md" radius="md" withBorder>
          <Text size="sm" mb="xs">
            Загрузка обновлений
          </Text>
          <Progress value={progress} size="lg" striped animated />
        </Card>*/}

        <Card>
          <Text size="sm" mb="xs">
            Обнаружен путь до установленной копии Valheim:
          </Text>
          <Text size="sm" mb="xs">
            {valheimPath}
          </Text>
        </Card>

        {/* Кнопка запуска */}
        <Center mt="md">
          <Button
            onClick={handleLaunch}
            size="xl"
            disabled={!valheimPath}
            leftSection={<IconPlayerPlay size={20} />}
          >
            Запустить Valheim
          </Button>
        </Center>
      </Stack>
    </Container>
  );
}
