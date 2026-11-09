import axios from 'axios';
import { ENV } from '@/config/env';

export const healthApi = {
  checkSso: async (): Promise<boolean> => {
    try {
      await axios.get(`${ENV.API_BASE_URL}/health`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  },

  // Autogestión no permite llamadas CORS desde el browser.
  // Delegamos el chequeo al backend del SSO que sí puede consultarlo.
  checkAutogestion: async (): Promise<boolean> => {
    try {
      await axios.get(`${ENV.API_BASE_URL}/health/autogestion`, { timeout: 8000 });
      return true;
    } catch {
      return false;
    }
  },
};