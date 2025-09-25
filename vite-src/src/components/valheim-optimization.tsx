import { Checkbox, Card, Text, Group } from '@mantine/core';
import { useValheimOptimization } from '@/hooks/use-valheim-optimization.ts';

export const ValheimOptimization = () => {
  const { valheimOptimization, valheimPathValid, handleOptimizationChange } = useValheimOptimization();

  return (
    <Card>
      <Group justify="space-between" align="center">
        <div>
          <Text size="sm" fw={500}>
            Оптимизация Valheim
          </Text>
          <Text size="xs" c="dimmed">
            {valheimPathValid
              ? 'Включает оптимизации производительности в Boot.config'
              : 'Требуется валидный путь к Valheim'
            }
          </Text>
        </div>
        <Checkbox
          checked={valheimOptimization}
          onChange={(event) => handleOptimizationChange(event.currentTarget.checked)}
          disabled={!valheimPathValid}
          size="md"
        />
      </Group>
    </Card>
  );
};