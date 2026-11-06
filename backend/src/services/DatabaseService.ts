import { Pool } from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Columns declared JSONB in the Postgres schema (stored as TEXT in SQLite)
const JSON_COLUMNS = new Set(['preferences', 'metadata', 'action_config']);

export class DatabaseService {
  private static pgPool: Pool | null = null;
  private static sqliteDb: sqlite3.Database | null = null;
  private static isPostgres = false;
  private static initialized = false;

  /**
   * Initializes the database connection, checking Postgres first, then falling back to SQLite.
   */
  public static async initialize(): Promise<void> {
    if (this.initialized) return;

    const dbUrl = process.env.DATABASE_URL;
    
    if (dbUrl) {
      try {
        console.log('JARVIS DB: Attempting to connect to PostgreSQL...');
        this.pgPool = new Pool({
          connectionString: dbUrl,
          connectionTimeoutMillis: 5000 // 5 seconds timeout
        });
        
        // Test connection
        const client = await this.pgPool.connect();
        client.release();
        
        this.isPostgres = true;
        console.log('JARVIS DB: Successfully connected to PostgreSQL.');
      } catch (err) {
        console.warn('JARVIS DB: Failed to connect to PostgreSQL. Error:', (err as Error).message);
        console.warn('JARVIS DB: Falling back to SQLite...');
        this.setupSqlite();
      }
    } else {
      console.log('JARVIS DB: DATABASE_URL not specified. Defaulting to SQLite.');
      this.setupSqlite();
    }

    await this.createTables();
    this.initialized = true;
  }

  private static setupSqlite(): void {
    const dbPath = path.join(__dirname, '../../jarvis.sqlite');
    console.log(`JARVIS DB: Initializing SQLite database at ${dbPath}`);
    
    // Ensure parent directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.sqliteDb = new sqlite3.Database(dbPath);
    this.isPostgres = false;
  }

  /**
   * Execute a query with parameters using unified $1, $2 syntax.
   */
  public static async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.isPostgres && this.pgPool) {
      const res = await this.pgPool.query(sql, params);
      return res.rows;
    } else if (this.sqliteDb) {
      // Translate PostgreSQL parameters ($1, $2, etc.) to SQLite parameters (?, ?)
      const sqliteSql = sql.replace(/\$\d+/g, '?');
      
      return new Promise<T[]>((resolve, reject) => {
        // Map common postgres JSON functions or types if necessary, but we write standard ANSI SQL
        this.sqliteDb!.all(sqliteSql, params, (err, rows) => {
          if (err) {
            console.error('SQLite execution error: ', sqliteSql, params, err);
            reject(err);
          } else {
            // SQLite returns JSON columns as strings. Parse only the known JSON columns,
            // so free text (e.g. a chat message that happens to look like JSON) stays a string.
            const parsedRows = rows.map((row: any) => {
              const newRow = { ...row };
              for (const key in newRow) {
                if (JSON_COLUMNS.has(key) && typeof newRow[key] === 'string') {
                  const val = newRow[key].trim();
                  if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
                    try {
                      newRow[key] = JSON.parse(val);
                    } catch {
                      // Keep as string if parsing fails
                    }
                  }
                }
              }
              return newRow;
            });
            resolve(parsedRows as T[]);
          }
        });
      });
    }
    
    throw new Error('Database not initialized');
  }

  /**
   * Formats a Date as 'YYYY-MM-DD HH:MM:SS' (UTC), the format CURRENT_TIMESTAMP produces.
   * SQLite compares timestamps as text, so an ISO string ('...T...Z') would sort incorrectly.
   */
  public static toTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').slice(0, 19);
  }

  /**
   * Helper to execute query and return single row or null.
   */
  public static async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Closes database connection pools.
   */
  public static async close(): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.end();
      this.pgPool = null;
    }
    if (this.sqliteDb) {
      await new Promise<void>((resolve) => this.sqliteDb!.close(() => resolve()));
      this.sqliteDb = null;
    }
    this.initialized = false;
  }

  private static async createTables(): Promise<void> {
    if (this.isPostgres) {
      // PostgreSQL Schema
      const schema = `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255),
          avatar VARCHAR(1000),
          preferences JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS oauth_credentials (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expiry_date BIGINT NOT NULL,
          scopes TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          model VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
          role VARCHAR(50) NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS automations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          trigger_type VARCHAR(50) NOT NULL,
          cron_expression VARCHAR(100) NOT NULL,
          action_type VARCHAR(100) NOT NULL,
          action_config JSONB DEFAULT '{}'::jsonb,
          is_active BOOLEAN DEFAULT TRUE,
          last_run_at TIMESTAMP,
          next_run_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS automation_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          automation_id UUID REFERENCES automations(id) ON DELETE CASCADE,
          status VARCHAR(50) NOT NULL,
          output TEXT,
          run_duration_ms INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          action_type VARCHAR(100) NOT NULL,
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      // Postgres supports running multiple statements split by semicolon via pg pool
      await this.pgPool!.query(schema);
    } else {
      // SQLite Schema (using compatible SQLite dialect)
      const statements = [
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          avatar TEXT,
          preferences TEXT DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS oauth_credentials (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expiry_date INTEGER NOT NULL,
          scopes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          model TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          metadata TEXT DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS automations (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          trigger_type TEXT NOT NULL,
          cron_expression TEXT NOT NULL,
          action_type TEXT NOT NULL,
          action_config TEXT DEFAULT '{}',
          is_active INTEGER DEFAULT 1,
          last_run_at DATETIME,
          next_run_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS automation_logs (
          id TEXT PRIMARY KEY,
          automation_id TEXT REFERENCES automations(id) ON DELETE CASCADE,
          status TEXT NOT NULL,
          output TEXT,
          run_duration_ms INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS activity_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          action_type TEXT NOT NULL,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ];

      for (const sql of statements) {
        await new Promise<void>((resolve, reject) => {
          this.sqliteDb!.run(sql, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    }
  }
}
