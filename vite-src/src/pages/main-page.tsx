import { Container, Stack, Center } from '@mantine/core';
import { ValheimPath } from '@/components/valheim-path.tsx';
import { ServerCheck } from '@/components/server-check.tsx';
import { ValheimLaunch } from '@/components/valheim-launch.tsx';
import { LoadingBar } from '@/components/loading-bar.tsx';

export default function MainPage() {
  return (
    <Container size="md" py="md" h="85vh" style={{ justifyContent: 'flex-end' }}>
      <ServerCheck />
      <Stack gap="lg" h="85vh" justify="flex-end">
        <ValheimPath />

        <LoadingBar />

        <Center mt="md">
          <ValheimLaunch />
        </Center>
      </Stack>
    </Container>
  );
}
