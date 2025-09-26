import { Accordion, Card, Progress, Text, Group, Badge, Button } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/shared/store/types';
import { progressInfoSelector, clearError } from '@/features/progress/progress.slice';
import { loadArchives } from '@/shared/actions/load-archives';
import { IconRefresh } from '@tabler/icons-react';
import { useSelector } from 'react-redux';
import { valheimPathValidSelector } from '@/features/settings/settings.slice.ts';

export const LoadingBar = () => {
  const progressInfo = useAppSelector(progressInfoSelector);
  const valheimPathValid = useSelector(valheimPathValidSelector);
  const dispatch = useAppDispatch();

  const handleRetry = () => {
    dispatch(clearError());
    dispatch(loadArchives());
  };

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'download':
        return '📥';
      case 'extract':
        return '📦';
      case 'idle':
        return '✅';
      default:
        return '⚙️';
    }
  };

  const getOperationText = (operation: string) => {
    switch (operation) {
      case 'download':
        return 'Загрузка файлов';
      case 'extract':
        return 'Распаковка файлов';
      case 'idle':
        return 'Все файлы в порядке';
      default:
        return 'Обработка файлов';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getProgressColor = () => {
    if (progressInfo.error) return 'red';
    if (progressInfo.isLoading) return 'blue';
    return 'green';
  };

  const getStatusText = () => {
    if (progressInfo.error) {
      return 'Ошибка загрузки файлов';
    }
    if (progressInfo.isLoading) {
      return `${progressInfo.operation === 'download' ? 'Загрузка' : 'Распаковка'} файлов...`;
    }
    return 'Все файлы загружены и готовы к использованию';
  };

  return (
    <Accordion value={valheimPathValid ? 'show' : ''} unstyled>
      <Accordion.Item value="show">
        <Accordion.Panel>
          <Card shadow="sm" p="md" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                {getOperationIcon(progressInfo.operation)}{' '}
                {getOperationText(progressInfo.operation)}
              </Text>
              {progressInfo.isLoading && (
                <Badge color={getProgressColor()} variant="light">
                  {progressInfo.progress}%
                </Badge>
              )}
            </Group>

            {progressInfo.isLoading ? (
              <>
                <Progress
                  value={progressInfo.progress}
                  size="lg"
                  striped
                  animated
                  color={getProgressColor()}
                  mb="xs"
                />

                {progressInfo.currentFile && (
                  <Text size="xs" c="dimmed" truncate>
                    {progressInfo.currentFile}
                  </Text>
                )}

                {progressInfo.operation === 'download' && progressInfo.totalSize > 0 && (
                  <Text size="xs" c="dimmed">
                    {formatBytes(progressInfo.downloadedSize)} /{' '}
                    {formatBytes(progressInfo.totalSize)}
                  </Text>
                )}

                {progressInfo.operation === 'extract' && progressInfo.totalFiles > 0 && (
                  <Text size="xs" c="dimmed">
                    Извлечено {progressInfo.extractedFiles} из {progressInfo.totalFiles} файлов
                  </Text>
                )}
              </>
            ) : (
              <Text size="sm" c={progressInfo.error ? 'red' : 'green'}>
                {getStatusText()}
              </Text>
            )}

            {progressInfo.error && (
              <Group mt="xs" justify="space-between" align="center">
                <Text size="xs" c="red">
                  ❌ {progressInfo.error}
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  leftSection={<IconRefresh size={14} />}
                  onClick={handleRetry}
                >
                  Попробовать еще раз
                </Button>
              </Group>
            )}
          </Card>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
};
