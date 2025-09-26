import path from 'path';
import dotenv from 'dotenv/lib/main.js';

export const loadEnv = () => {
  const envpath = path.join(__dirname, '..', '.env');

  console.log(envpath);

  const result = dotenv.config({ path: envpath });
  console.log(`dotenv: `, result);
};
