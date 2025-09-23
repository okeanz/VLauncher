import { Accordion, Card, Progress, Text } from '@mantine/core';

export const LoadingBar = () => {
  return (
    <Accordion value="show" unstyled>
      <Accordion.Item value="show">
        <Accordion.Panel>
          <Card shadow="sm" p="md" radius="md" withBorder>
            <Text size="sm" mb="xs">
              Загрузка обновлений
            </Text>
            <Progress value={25} size="lg" striped animated />
          </Card>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
};
