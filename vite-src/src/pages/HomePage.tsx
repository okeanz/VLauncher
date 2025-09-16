import { Button, Group, Paper, Text, Title } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <Paper p="xl" shadow="sm" withBorder>
      <Title order={1} ta="center" mb="lg">
        React Redux Boilerplate
      </Title>

      <Text size="lg" ta="center" mb="xl" c="dimmed">
        Minimal boilerplate with React 19, Redux Toolkit, Mantine UI, and Vite
      </Text>

      <Group justify="center">
        <Button
          component={Link}
          to="/counter"
          rightSection={<IconArrowRight size={16} />}
          size="lg"
        >
          Try Counter Demo
        </Button>
      </Group>

      <Text size="sm" ta="center" mt="xl" c="dimmed">
        This boilerplate includes:
      </Text>
      <Text size="sm" ta="center" c="dimmed">
        • React 19 with TypeScript • Redux Toolkit for state management • Mantine UI components •
        React Router for navigation • Vite for fast development • Tailwind CSS for styling
      </Text>
    </Paper>
  );
}
