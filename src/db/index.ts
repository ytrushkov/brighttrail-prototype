import 'dotenv/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const sqlite = new Database(process.env.DB_FILE_NAME || 'sqlite.db');
export const db = drizzle(sqlite, { schema });
