import { useState, useEffect, useRef } from 'react';
import { getErrorMessage } from '@/utils/apiError';
import {
  Box, Title, Text, Tabs, TextInput, Button,
  Alert, Paper, Table, Badge, Group, FileButton,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconUpload, IconDownload, IconLoader } from '@tabler/icons-react';
import { studentsApi } from '@/api/studentsApi';
import { rolesApi } from '@/api/rolesApi';
import { specialtiesApi } from '@/api/specialtiesApi';
import { DomainRoleResponse, SpecialtyResponse, ImportPreviewResult, ImportConfirmPayload } from '@/types/api.types';
import { AssignmentFields } from '@/components/students/AssignmentFields';
import { assignmentErrors } from '@/utils/assignmentRules';

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.ods'];
// Mismos topes que el backend: más de 5 MB o 500 alumnos por archivo se rechaza.
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.oasis.opendocument.spreadsheet', // .ods (LibreOffice)
];

/**
 * Texto de cargos/especialidades de una fila de la vista previa. Las filas válidas traen ids (se muestran
 * con su nombre); las inválidas traen el texto tal como estaba en el Excel.
 */
function previewNames(
  data: Record<string, unknown>, idsKey: string, rawKey: string, catalog: { id: number; name: string }[],
): string {
  const ids = data[idsKey];
  if (Array.isArray(ids)) {
    return ids.map(id => catalog.find(c => c.id === id)?.name ?? `#${String(id)}`).join(', ');
  }
  const raw = data[rawKey];
  return typeof raw === 'string' ? raw : '';
}

export function CargarUsuariosPage() {
  const [roles, setRoles] = useState<DomainRoleResponse[]>([]);
  const [specs, setSpecs] = useState<SpecialtyResponse[]>([]);

  // Individual
  const [iFirstName, setIFirstName] = useState('');
  const [iLastName, setILastName] = useState('');
  const [iDni, setIDni] = useState('');
  const [iEmail, setIEmail] = useState('');
  const [iBirthDate, setIBirthDate] = useState('');
  const [iRoleIds, setIRoleIds] = useState<string[]>([]);
  const [iSpecIds, setISpecIds] = useState<string[]>([]);
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
  const [downloadLoading, setDownloadLoading] = useState(false);
  const resetFileRef = useRef<() => void>(null);

  useEffect(() => {
    void rolesApi.findAll().then(setRoles);
    void specialtiesApi.findAll().then(setSpecs);
  }, []);

  const handleIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    setIError(null); setISuccess(null);
    const ruleErrors = assignmentErrors(roles, iRoleIds, iSpecIds);
    if (ruleErrors.length) { setIError(ruleErrors.join(' ')); return; }
    setILoading(true);
    try {
      const res = await studentsApi.create({
        first_name: iFirstName, last_name: iLastName,
        dni: parseInt(iDni, 10), email: iEmail,
        birth_date: iBirthDate,
        domain_role_ids: iRoleIds.map(Number),
        specialty_ids: iSpecIds.map(Number),
      });
      setISuccess(`Usuario creado con nombre de usuario: ${res.username}. Se envió un email de bienvenida a ${iEmail}.`);
      setIFirstName(''); setILastName(''); setIDni(''); setIEmail('');
      setIBirthDate(''); setIRoleIds([]); setISpecIds([]);
    } catch (err) {
      setIError(getErrorMessage(err, 'Error al crear el usuario.'));
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
    const hasValidMime = ALLOWED_MIME_TYPES.includes(file.type);

    if (!hasValidExtension || !hasValidMime) {
      setCsvFile(null);
      resetFileRef.current?.();
      setPreviewError('Formato no válido. Solo se permiten archivos de Excel (.xlsx, .xls) o LibreOffice Calc (.ods).');
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setCsvFile(null);
      resetFileRef.current?.();
      setPreviewError('El archivo supera el máximo de 5 MB.');
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
      setPreviewError(getErrorMessage(err, 'Error al procesar el archivo.'));
    } finally { setPreviewLoading(false); }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    const validRows = preview.rows
      .filter(r => r.valid)
      // Las filas válidas ya vienen con la forma exacta que espera /import/confirm.
      .map(r => r.data as ImportConfirmPayload['rows'][number]);
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
      setPreviewError(getErrorMessage(err, 'Error al confirmar la importación.'));
    } finally { setConfirmLoading(false); }
  };

  return (
    <Box>
      <Title order={2} mb={4}>Cargar usuarios</Title>
      <Text c="dimmed" size="sm" mb="xl">Registrá nuevos usuarios de forma individual o mediante carga masiva por Excel.</Text>

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
                <TextInput label="DNI" placeholder="30123456" value={iDni} onChange={e => setIDni(e.target.value)} required inputMode="numeric" maxLength={10} />
                <TextInput label="Email" type="email" placeholder="alumno@gmail.com" value={iEmail} onChange={e => setIEmail(e.target.value)} required maxLength={254} />
              </Group>
              <TextInput label="Fecha de nacimiento" type="date" value={iBirthDate} onChange={e => setIBirthDate(e.target.value)} mb="sm" required />
              <Box mb="lg">
                <AssignmentFields
                  roles={roles}
                  specialties={specs}
                  roleIds={iRoleIds}
                  specialtyIds={iSpecIds}
                  onRoleIdsChange={setIRoleIds}
                  onSpecialtyIdsChange={setISpecIds}
                />
              </Box>
              <Button
                type="submit"
                fullWidth
                loading={iLoading}
                disabled={iRoleIds.length > 0 && iSpecIds.length > 0 && assignmentErrors(roles, iRoleIds, iSpecIds).length > 0}
              >
                Registrar usuario
              </Button>
            </form>
          </Paper>
        </Tabs.Panel>

        {/* ── Masiva ── */}
        <Tabs.Panel value="masiva">
          <Paper withBorder radius="md" p="lg">
            <Group mb="md">
              <Button
                variant="subtle"
                size="sm"
                leftSection={downloadLoading ? <IconLoader size={14} /> : <IconDownload size={14} />}
                loading={downloadLoading}
                onClick={async () => {
                  setDownloadLoading(true);
                  try { await studentsApi.downloadExampleXlsx(); }
                  catch { setPreviewError('Error al descargar el ejemplo.'); }
                  finally { setDownloadLoading(false); }
                }}
              >
                Descargar Excel de ejemplo
              </Button>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
              El archivo debe tener las columnas: <code>Nombre/s, Apellido/s, DNI, Email, Fecha de nacimiento, Cargo, Especialidad</code>.
              Las fechas se cargan como fechas normales de Excel (DD/MM/AAAA). Los valores de <strong>Cargo</strong> y <strong>Especialidad</strong>{' '}
              deben coincidir con los cargados en el sistema: el Excel de ejemplo los lista al costado de la planilla, junto con las reglas de cada cargo.
              Máximo <strong>500 alumnos</strong> y <strong>5 MB</strong> por archivo: si tenés más, dividilo en partes.
            </Text>
            <Text size="sm" c="dimmed" mb="md">
              <strong>Varios cargos o especialidades:</strong> escribilos en la misma celda separados por punto y coma, por ejemplo{' '}
              <code>Profesor; Preceptor</code>. Si alguno de los cargos <em>no se combina</em>, tiene que ser el único de la fila; si
              alguno exige <em>exactamente una especialidad</em>, la fila debe tener una sola. Las filas que no cumplan se marcan con error y no se importan.
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
          </Paper>

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
                    <Table.Th>Cargos</Table.Th>
                    <Table.Th>Especialidades</Table.Th>
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
                      <Table.Td>{previewNames(r.data, 'domainRoleIds', 'domain_role', roles)}</Table.Td>
                      <Table.Td>{previewNames(r.data, 'specialtyIds', 'specialty', specs)}</Table.Td>
                      <Table.Td style={{ color: 'red' }}>{r.errors?.join('; ')}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              {preview.valid > 0 && (
                <Button onClick={() => void handleConfirm()} loading={confirmLoading}>
                  Importar {preview.valid} fila(s) válida(s)
                </Button>
              )}
            </>
          )}
          
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}