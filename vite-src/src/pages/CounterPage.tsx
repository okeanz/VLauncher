import { Counter } from '@/features/counter/components/Counter';
import { Button, Group, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

export function CounterPage() {
  return (
    <>
      <Group mb="lg">
        <Button component={Link} to="/" leftSection={<IconArrowLeft size={16} />} variant="subtle">
          Back to Home
        </Button>
      </Group>

      <Title order={1} ta="center" mb="xl">
        Counter Feature
      </Title>

      <Counter />
    </>
  );
}
