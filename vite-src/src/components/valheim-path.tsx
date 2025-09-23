import { Button, Card, Grid, Input, Text } from '@mantine/core';
import { useSelector } from 'react-redux';
import {
  valheimPathSelector,
  valheimPathValidSelector,
} from '@/features/settings/settings.slice.ts';
import { os } from '@neutralinojs/lib';
import { setValheimPath } from '@/features/settings/settings.actions.ts';
import { useAppDispatch } from '@/shared/store/types.ts';

export const ValheimPath = () => {
  const dispatch = useAppDispatch();

  const valheimPath = useSelector(valheimPathSelector);
  const valheimPathValid = useSelector(valheimPathValidSelector);

  const showDialog = async () => {
    const result = await os.showFolderDialog('Выберите папку', {
      defaultPath: valheimPath ?? 'C:/',
    });
    dispatch(setValheimPath(result));
  };

  return (
    <Card>
      <Text size="sm" mb="xs">
        {valheimPath && valheimPathValid
          ? 'Обнаружен путь до установленной копии Valheim:'
          : 'Нажмите "Обзор" и выберите путь до папки с установленным Valheim'}
      </Text>
      {valheimPath && !valheimPathValid && (
        <Text size="xs" mb="xs" c="orange">
          По указанному пути не найден valheim.exe
        </Text>
      )}
      <Grid grow>
        <Grid.Col span={10}>
          <Input
            placeholder="C:/Program Files (x86)/Steam/steamapps/common/Valheim"
            value={valheimPath}
            readOnly={true}
          />
        </Grid.Col>
        <Grid.Col span={2}>
          <Button fullWidth={true} onClick={showDialog}>
            Обзор
          </Button>
        </Grid.Col>
      </Grid>
    </Card>
  );
};
