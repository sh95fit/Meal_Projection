// lib/mysql/client.ts
import { Client as SSHClient } from "ssh2";
import mysql, { type RowDataPacket } from "mysql2/promise";
import fs from "fs";
import path from "path";
import type { Duplex } from "stream";

// ─── SSH 키 로드 ───

function getSSHPrivateKey(): string | Buffer {
  if (process.env.SSH_PRIVATE_KEY) {
    return process.env.SSH_PRIVATE_KEY;
  }
  const keyPath = path.resolve(process.env.SSH_KEY_PATH || "test.pem");
  return fs.readFileSync(keyPath);
}

// ─── ★ #9: 듀얼 SSH 커넥션 풀 ───

interface SSHEntry {
  ssh: SSHClient;
  ready: boolean;
}

const MAX_SSH_CONNECTIONS = 2;
const sshPool: (SSHEntry | null)[] = new Array(MAX_SSH_CONNECTIONS).fill(null);
let sshRoundRobin = 0;

function createSSHConnection(): Promise<SSHClient> {
  return new Promise((resolve, reject) => {
    const ssh = new SSHClient();
    ssh
      .on("ready", () => resolve(ssh))
      .on("error", (err) => reject(err))
      .connect({
        host: process.env.SSH_HOST!,
        port: parseInt(process.env.SSH_PORT || "22"),
        username: process.env.SSH_USER || "ubuntu",
        privateKey: getSSHPrivateKey(),
      });
  });
}

async function getSSHClient(index: number): Promise<SSHClient> {
  const entry = sshPool[index];

  if (entry && entry.ready) {
    return entry.ssh;
  }

  // 기존 연결이 있으면 정리
  if (entry) {
    try {
      entry.ssh.end();
    } catch {
      // ignore
    }
    sshPool[index] = null;
  }

  const ssh = await createSSHConnection();

  ssh.on("close", () => {
    if (sshPool[index]?.ssh === ssh) {
      sshPool[index] = null;
    }
  });

  ssh.on("error", () => {
    if (sshPool[index]?.ssh === ssh) {
      sshPool[index] = null;
    }
  });

  sshPool[index] = { ssh, ready: true };
  return ssh;
}

function getNextSSHIndex(): number {
  const idx = sshRoundRobin % MAX_SSH_CONNECTIONS;
  sshRoundRobin++;
  return idx;
}

async function forwardOutFromPool(): Promise<{ stream: Duplex }> {
  const idx = getNextSSHIndex();

  // 최대 2회 재시도 (SSH 연결이 죽었을 경우)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ssh = await getSSHClient(idx);
      const stream = await new Promise<Duplex>((resolve, reject) => {
        ssh.forwardOut(
          "127.0.0.1",
          0,
          process.env.DB_HOST!,
          parseInt(process.env.DB_PORT || "3306"),
          (err, stream) => {
            if (err) reject(err);
            else resolve(stream);
          }
        );
      });
      return { stream };
    } catch {
      // SSH 연결 끊김 → 재생성 시도
      sshPool[idx] = null;
      if (attempt === 1) throw new Error(`SSH forward failed after retries (pool index ${idx})`);
    }
  }

  throw new Error("SSH forward failed");
}

// ─── 직접 연결용 풀 (SSH 없는 환경) ───

let directPool: mysql.Pool | null = null;

function getDirectPool(): mysql.Pool {
  if (!directPool) {
    directPool = mysql.createPool({
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      database: process.env.DB_ORDER_SERVICE || "order_service",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 50,
      idleTimeout: 60000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }
  return directPool;
}

// ─── 세마포어 ───

class Semaphore {
  private queue: (() => void)[] = [];
  private running = 0;
  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  release(): void {
    this.running--;
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    }
  }
}

// ─── 공개 API ───

const useSSH = !!(process.env.SSH_HOST && (process.env.SSH_PRIVATE_KEY || process.env.SSH_KEY_PATH));

// ★ #9: SSH 시 세마포어 3→5 (듀얼 SSH로 처리량 증가)
const querySemaphore = new Semaphore(useSSH ? 5 : 8);

export async function queryMySQL<T = RowDataPacket>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  await querySemaphore.acquire();
  try {
    if (useSSH) {
      return await queryViaSSH<T>(sql, params);
    } else {
      return await queryDirect<T>(sql, params);
    }
  } finally {
    querySemaphore.release();
  }
}

// ─── SSH 경유 쿼리 ───

async function queryViaSSH<T>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  // ★ #9: 듀얼 SSH 풀에서 라운드 로빈으로 스트림 획득
  const { stream } = await forwardOutFromPool();

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_ORDER_SERVICE || "order_service",
    stream,
  });

  try {
    const [rows] = await connection.query<RowDataPacket[]>(sql, params);
    return rows as T[];
  } finally {
    await connection.end();
  }
}

// ─── 직접 연결 쿼리 (풀 사용) ───

async function queryDirect<T>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = getDirectPool();
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows as T[];
}