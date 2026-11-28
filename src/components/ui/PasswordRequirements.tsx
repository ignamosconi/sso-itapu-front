import { List, Text, ThemeIcon, VisuallyHidden } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { PASSWORD_REQUIREMENTS, exceedsPasswordBytes, PASSWORD_BYTES_MESSAGE } from '@/utils/passwordPolicy';

interface Props {
  password: string;
  mb?: string;
}

/**
 * Lista en vivo de los requisitos de la contraseña: cada uno con tilde verde si se cumple o cruz roja si falta,
 * así el usuario ve de una todo lo que le falta mientras escribe.
 */
export function PasswordRequirements({ password, mb = 'sm' }: Props) {
  const tooLong = exceedsPasswordBytes(password);
  return (
    <div aria-live="polite" data-testid="password-requirements">
      <Text size="xs" c="dimmed" mb={4}>La contraseña tiene que tener:</Text>
      <List spacing={2} size="xs" mb={mb} center>
        {PASSWORD_REQUIREMENTS.map(r => {
          const ok = r.test(password);
          return (
            <List.Item
              key={r.key}
              data-ok={ok}
              icon={
                <ThemeIcon color={ok ? 'teal' : 'red'} size={16} radius="xl" variant="light">
                  {ok ? <IconCheck size={11} /> : <IconX size={11} />}
                </ThemeIcon>
              }
            >
              <Text size="xs" c={ok ? 'teal' : 'red'}>
                {r.label}
                <VisuallyHidden>{ok ? ' (cumplido)' : ' (falta)'}</VisuallyHidden>
              </Text>
            </List.Item>
          );
        })}
        {tooLong && (
          <List.Item
            data-ok={false}
            icon={
              <ThemeIcon color="red" size={16} radius="xl" variant="light">
                <IconX size={11} />
              </ThemeIcon>
            }
          >
            <Text size="xs" c="red">{PASSWORD_BYTES_MESSAGE}</Text>
          </List.Item>
        )}
      </List>
    </div>
  );
}
