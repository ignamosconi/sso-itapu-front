import { useState, useEffect, useRef } from 'react';
import {
  Box, Title, Text, Tabs, TextInput, Button,
  Select, Alert, Paper, Table, Badge, Group, Anchor, FileButton,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconUpload, IconDownload } from '@tabler/icons-react';
import { studentsApi } from '@/api/studentsApi';
import { rolesApi } from '@/api/rolesApi';
import { specialtiesApi } from '@/api/specialtiesApi';
import { DomainRoleResponse, SpecialtyResponse, ImportPreviewResult } from '@/types/api.types';
import { ENV } from '@/config/env';

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.ods'];
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.oasis.opendocument.spreadsheet', // .ods (LibreOffice)
];

export function CargarUsuariosPage() {
  const [roles, setRoles] = useState<DomainRoleResponse[]>([]);
  const [specs, setSpecs] = useState<SpecialtyResponse[]>([]);

  // Individual
  const [iFirstName, setIFirstName] = useState('');
  const [iLastName, setILastName] = useState('');
  const [iDni, setIDni] = useState('');
  const [iEmail, setIEmail] = useState('');
  const [iBirthDate, setIBirthDate] = useState('');
  const [iRoleId, setIRoleId] = useState<string | null>(null);
  const [iSpecId, setISpecId] = useState<string | null>(null);
  const [iError, setIError] = useState<string | null>(null);
  const [iSuccess, setISuccess] = useState<string | null>(null);
  const [iLoading, setILoading] = useState(false);

  // Masiva
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
  const resetFileRef = useRef<() => void>(null);

  useEffect(() => {
    void rolesApi.findAll().then(setRoles);
    void specialtiesApi.findAll().then(setSpecs);
  }, []);

  const handleIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    setIError(null); setISuccess(null); setILoading(true);
    try {
      const res = await studentsApi.create({
        first_name: iFirstName, last_name: iLastName,
        dni: parseInt(iDni, 10), email: iEmail,
        birth_date: iBirthDate,
        domain_role_id: parseInt(iRoleId ?? '0', 10),
        specialty_id: parseInt(iSpecId ?? '0', 10),
      });
      setISuccess(`Usuario creado con nombre de usuario: ${res.username}. Se envió un email de bienvenida a ${iEmail}.`);
      setIFirstName(''); setILastName(''); setIDni(''); setIEmail('');
      setIBirthDate(''); setIRoleId(null); setISpecId(null);
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string | string[] } } };
      const msg = ax?.response?.data?.message;
      setIError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Error al crear el usuario.'));
    } finally { setILoading(false); }
  };

  const handleFileSelect = (file: File | null) => {
    setPreview(null);
    setConfirmSuccess(null);

    if (!file) {
      setCsvFile(null);
      return;
    }

    const fileName = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
    const hasValidMime = !file.type || ALLOWED_MIME_TYPES.includes(file.type);

    if (!hasValidExtension || !hasValidMime) {
      setCsvFile(null);
      resetFileRef.current?.();
      setPreviewError('Formato no válido. Solo se permiten archivos de Excel (.xlsx, .xls) o LibreOffice Calc (.ods).');
      return;
    }

    setPreviewError(null);
    setCsvFile(file);
  };

  const handlePreview = async () => {
    if (!csvFile) return;
    setPreviewError(null); setPreview(null); setConfirmSuccess(null); setPreviewLoading(true);
    try {
      setPreview(await studentsApi.importPreview(csvFile));
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } } };
      setPreviewError(ax?.response?.data?.message ?? 'Error al procesar el archivo.');
    } finally { setPreviewLoading(false); }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    const validRows = preview.rows
      .filter(r => r.valid)
      .map(r => r.data as { first_name: string; last_name: string; dni: number; email: string; birth_date: string; domainRoleId: number; specialtyId: number });
    setConfirmLoading(true);
    try {
      const result = await studentsApi.importConfirm({ rows: validRows });
      setConfirmSuccess(
        `Importación completada: ${result.imported} usuario(s) creados.` +
        (result.usernameCollisions > 0 ? ` ${result.usernameCollisions} nombre(s) de usuario ajustado(s) por colisión.` : ''),
      );
      setPreview(null);
      setCsvFile(null);
      resetFileRef.current?.();
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string } } };
      setPreviewError(ax?.response?.data?.message ?? 'Error al confirmar la importación.');
    } finally { setConfirmLoading(false); }
  };

  return (
    <Box>
      <Title order={2} mb={4}>Cargar usuarios</Title>
      <Text c="dimmed" size="sm" mb="xl">Registrá nuevos usuarios de forma individual o mediante carga masiva por CSV.</Text>

      <Tabs defaultValue="individual" variant="outline" radius="md">
        <Tabs.List mb="lg">
          <Tabs.Tab value="individual">Alta individual</Tabs.Tab>
          <Tabs.Tab value="masiva" leftSection={<IconUpload size={14} />}>Carga masiva</Tabs.Tab>
        </Tabs.List>

        {/* ── Individual ── */}
        <Tabs.Panel value="individual">
          <Paper withBorder radius="md" p="lg" maw={520}>
            {iError && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" radius="md">{iError}</Alert>}
            {iSuccess && <Alert icon={<IconCheck size={16} />} color="green" mb="md" radius="md">{iSuccess}</Alert>}
            <form onSubmit={e => void handleIndividual(e)}>
              <Group grow mb="sm">
                <TextInput label="Nombres" placeholder="Ignacio Mariano" value={iFirstName} onChange={e => setIFirstName(e.target.value)} required minLength={2} maxLength={64} />
                <TextInput label="Apellidos" placeholder="Mosconi" value={iLastName} onChange={e => setILastName(e.target.value)} required minLength={2} maxLength={64} />
              </Group>
              <Group grow mb="sm">
                <TextInput label="DNI" placeholder="44244136" value={iDni} onChange={e => setIDni(e.target.value)} required />
                <TextInput label="Email" type="email" placeholder="alumno@gmail.com" value={iEmail} onChange={e => setIEmail(e.target.value)} required />
              </Group>
              <TextInput label="Fecha de nacimiento" type="date" value={iBirthDate} onChange={e => setIBirthDate(e.target.value)} mb="sm" required />
              <Group grow mb="lg">
                <Select label="Rol institucional" placeholder="Seleccioná..." value={iRoleId} onChange={setIRoleId}
                  data={roles.map(r => ({ value: String(r.id), label: r.name }))} required />
                <Select label="Especialidad" placeholder="Seleccioná..." value={iSpecId} onChange={setISpecId}
                  data={specs.map(s => ({ value: String(s.id), label: s.name }))} required />
              </Group>
              <Button type="submit" fullWidth loading={iLoading} style={{ background: '#f5a705', color: '#1a1200' }}>
                Registrar usuario
              </Button>
            </form>
          </Paper>
        </Tabs.Panel>

        {/* ── Masiva ── */}
        <Tabs.Panel value="masiva">
          <Paper withBorder radius="md" p="lg">
            <Group mb="md">
              <Anchor href={`${ENV.API_BASE_URL}/admin/students/import/example`} target="_blank" size="sm">
                <Group gap={4}><IconDownload size={14} /> Descargar CSV de ejemplo</Group>
              </Anchor>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
              El archivo debe incluir las columnas: <code>first_name, last_name, dni, email, birth_date, domain_role, specialty</code>.
              La fecha debe estar en formato <code>YYYY-MM-DD</code>. Los roles y especialidades deben coincidir exactamente con los cargados en el sistema.
            </Text>

            {previewError && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{previewError}</Alert>}
            {confirmSuccess && <Alert icon={<IconCheck size={16} />} color="green" mb="md">{confirmSuccess}</Alert>}

            <Group mb="md" align="flex-end">
              <Box>
                <Text size="sm" fw={500} mb={4}>Archivo Excel</Text>
                <FileButton
                  resetRef={resetFileRef}
                  onChange={handleFileSelect}
                  accept=".xlsx,.xls,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.oasis.opendocument.spreadsheet"
                >
                  {(props) => (
                    <Button {...props} variant="default">
                      {csvFile ? csvFile.name : 'Subir padrón'}
                    </Button>
                  )}
                </FileButton>
              </Box>
              <Button onClick={() => void handlePreview()} loading={previewLoading} disabled={!csvFile} variant="outline">
                Previsualizar
              </Button>
            </Group>

            {preview && (
              <>
                <Text size="sm" mb="sm">
                  <strong>{preview.total}</strong> filas — <strong style={{ color: 'green' }}>{preview.valid} válidas</strong>
                  {preview.invalid > 0 && <> — <strong style={{ color: 'red' }}>{preview.invalid} con errores</strong></>}
                </Text>
                <Table striped withTableBorder mb="md" style={{ fontSize: 12 }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>Estado</Table.Th>
                      <Table.Th>Nombre</Table.Th>
                      <Table.Th>DNI</Table.Th>
                      <Table.Th>Email</Table.Th>
                      <Table.Th>Errores</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {preview.rows.map(r => (
                      <Table.Tr key={r.rowNumber} style={{ background: r.valid ? undefined : 'rgba(239,68,68,0.06)' }}>
                        <Table.Td>{r.rowNumber}</Table.Td>
                        <Table.Td><Badge color={r.valid ? 'green' : 'red'} size="xs">{r.valid ? 'OK' : 'Error'}</Badge></Table.Td>
                        <Table.Td>{String((r.data as Record<string, unknown>).first_name ?? '')} {String((r.data as Record<string, unknown>).last_name ?? '')}</Table.Td>
                        <Table.Td>{String((r.data as Record<string, unknown>).dni ?? '')}</Table.Td>
                        <Table.Td>{String((r.data as Record<string, unknown>).email ?? '')}</Table.Td>
                        <Table.Td style={{ color: 'red' }}>{r.errors?.join('; ')}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                {preview.valid > 0 && (
                  <Button onClick={() => void handleConfirm()} loading={confirmLoading} style={{ background: '#f5a705', color: '#1a1200' }}>
                    Importar {preview.valid} fila(s) válida(s)
                  </Button>
                )}
              </>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}