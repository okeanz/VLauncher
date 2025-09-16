import {
  increment,
  decrement,
  incrementByAmount,
  reset,
  selectCount,
} from '@/features/counter/store/counter.slice';
import { useAppDispatch, useAppSelector } from '@/shared/store/types';
import { Button, Group, NumberInput, Paper, Text, Title } from '@mantine/core';
import { IconMinus, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';

export function Counter() {
  const count = useAppSelector(selectCount);
  const dispatch = useAppDispatch();
  const [incrementAmount, setIncrementAmount] = useState(1);

  return (
    <Paper p="xl" shadow="sm" withBorder>
      <Title order={2} ta="center" mb="lg">
        Counter Demo
      </Title>

      <Text size="xl" ta="center" mb="lg">
        Current value: <strong>{count}</strong>
      </Text>

      <Group justify="center" mb="lg">
        <Button
          leftSection={<IconMinus size={16} />}
          onClick={() => dispatch(decrement())}
          variant="outline"
        >
          -1
        </Button>

        <Button leftSection={<IconPlus size={16} />} onClick={() => dispatch(increment())}>
          +1
        </Button>
      </Group>

      <Group justify="center" mb="lg">
        <NumberInput
          value={incrementAmount}
          onChange={(value) => setIncrementAmount(Number(value) || 0)}
          min={-100}
          max={100}
          w={120}
        />
        <Button onClick={() => dispatch(incrementByAmount(incrementAmount))} variant="light">
          Add Amount
        </Button>
      </Group>

      <Group justify="center">
        <Button
          leftSection={<IconRefresh size={16} />}
          onClick={() => dispatch(reset())}
          color="red"
          variant="outline"
        >
          Reset
        </Button>
      </Group>
    </Paper>
  );
}
