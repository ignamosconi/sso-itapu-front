export const ENV = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  AUTOGESTION_URL: import.meta.env.VITE_AUTOGESTION_URL ?? 'https://webservice.frvm.utn.edu.ar/autogestion',
} as const;