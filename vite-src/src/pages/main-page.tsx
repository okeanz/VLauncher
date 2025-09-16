import { useState } from 'react';
import {
  Button,
  Card,
  Text,
  Progress,
  Container,
  Stack,
  Center,
} from '@mantine/core';
import { IconPlayerPlay } from '@tabler/icons-react';

export default function MainPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [progress, _setProgress] = useState(65); // пример прогресса


  return (
    <Container size="md" py="md" h='90vh' style={{justifyContent:'flex-end'}}>
      <Stack gap="lg" h='90vh' justify='flex-end'>

        {/* Прогресс-бар */}
        <Card shadow="sm" p="md" radius="md" withBorder>
          <Text size="sm" mb="xs">
            Загрузка обновлений
          </Text>
          <Progress value={progress} size="lg" striped animated />
        </Card>

        {/* Кнопка запуска */}
        <Center mt="md">
          <Button size="xl" leftSection={<IconPlayerPlay size={20} />}>
            Запустить Valheim
          </Button>
        </Center>
      </Stack>
    </Container>
  );
}
