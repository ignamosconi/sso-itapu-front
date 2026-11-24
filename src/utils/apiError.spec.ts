import { AxiosError, AxiosHeaders } from 'axios';
import { getErrorMessage, isNetworkError, serverMessage, NETWORK_ERROR_MESSAGE } from './apiError';

function httpError(status: number, data?: unknown, headers: Record<string, string> = {}) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('fail', 'ERR_BAD_REQUEST', config, {}, {
    status, statusText: '', data, headers, config,
  });
}

describe('serverMessage', () => {
  it('devuelve el texto tal cual', () => expect(serverMessage(httpError(400, { message: 'Nombre repetido.' }))).toBe('Nombre repetido.'));
  it('une un array de validaciones con espacios', () =>
    expect(serverMessage(httpError(400, { message: ['Uno.', 'Dos.'] }))).toBe('Uno. Dos.'));
  it('ignora elementos que no son texto', () => expect(serverMessage(httpError(400, { message: ['Uno.', 2, null] }))).toBe('Uno.'));
  it('devuelve vacío si no hay mensaje', () => {
    expect(serverMessage(httpError(400, {}))).toBe('');
    expect(serverMessage(undefined)).toBe('');
    expect(serverMessage(new Error('x'))).toBe('');
  });
});

describe('getErrorMessage', () => {
  it('usa el mensaje del servidor', () => expect(getErrorMessage(httpError(409, { message: 'Ya existe.' }), 'Error.')).toBe('Ya existe.'));
  it('usa el fallback si el servidor no dice nada', () => expect(getErrorMessage(httpError(400, {}), 'Error al guardar.')).toBe('Error al guardar.'));
  it('muestra el motivo real de una validación en array', () =>
    expect(getErrorMessage(httpError(400, { message: ['La redirect URI «http://localhost:3000» no puede apuntar a localhost en producción.'] }), 'Error al guardar.'))
      .toBe('La redirect URI «http://localhost:3000» no puede apuntar a localhost en producción.'));
  it('traduce un 429 con el tiempo de espera del header Retry-After', () =>
    expect(getErrorMessage(httpError(429, { message: 'ThrottlerException: Too Many Requests' }, { 'retry-after': '45' }), 'Error.'))
      .toBe('Estás haciendo peticiones demasiado rápido. Probá de nuevo en 45 segundos.'));
  it('traduce el bloqueo por intentos de contraseña', () =>
    expect(getErrorMessage(httpError(429, { code: 'PASSWORD_ATTEMPTS_LOCKED', retryAfterSeconds: 900 }), 'Error.'))
      .toBe('Se superó el máximo de intentos. Podrás volver a intentarlo en 15 minutos.'));
  it('traduce un error de red', () => {
    const err = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(isNetworkError(err)).toBe(true);
    expect(getErrorMessage(err, 'Error.')).toBe(NETWORK_ERROR_MESSAGE);
  });
  it('un error de programa (no de axios) no es un error de red', () => {
    expect(isNetworkError(new Error('boom'))).toBe(false);
    expect(getErrorMessage(new Error('boom'), 'Error al guardar.')).toBe('Error al guardar.');
  });
  it('traduce un 413', () => expect(getErrorMessage(httpError(413, { message: 'File too large' }), 'Error.')).toBe('El archivo es demasiado grande.'));
  it('no muestra textos técnicos de un 500', () =>
    expect(getErrorMessage(httpError(500, { message: 'Internal server error' }), 'Error al guardar.')).toBe('Error al guardar.'));
  it('sí muestra el mensaje en español de un 503', () =>
    expect(getErrorMessage(httpError(503, { message: 'El servicio de autenticación no está disponible. Intentá de nuevo.' }), 'Error.'))
      .toBe('El servicio de autenticación no está disponible. Intentá de nuevo.'));
});
