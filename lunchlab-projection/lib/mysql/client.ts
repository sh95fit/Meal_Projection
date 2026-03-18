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

// ─── SSH 터널 캐싱 ───
// 모듈 레벨 변수 — 서버리스 인스턴스가 살아있는 동안 유지됨

let cachedSSH: SSHClient | null = null;
let cachedStream: Duplex | null = null;
let sshReady = false;

function createSSHTunnel(): Promise<{ stream: Duplex; ssh: SSHClient }> {
  return new Promise((resolve, reject) => {
    const ssh = new SSHClient();

    ssh
      .on("ready", () => {
        ssh.forwardOut(
          "127.0.0.1",
          0,
          process.env.DB_HOST!,
          parseInt(process.env.DB_PORT || "3306"),
          (err, stream) => {
            if (err) {
              ssh.end();
              reject(err);
              return;
            }
            resolve({ stream, ssh });
          }
        );
      })
      .on("error", (err) => {
        // 캐시된 연결이 끊어졌으면 초기화
        cachedSSH = null;
        cachedStream = null;
        sshReady = false;
        reject(err);
      })
      .connect({
        host: process.env.SSH_HOST!,
        port: parseInt(process.env.SSH_PORT || "22"),
        username: process.env.SSH_USER || "ubuntu",
        privateKey: getSSHPrivateKey(),
      });
  });
}

async function getSSHTunnel(): Promise<{ stream: Duplex; ssh: SSHClient }> {
  // 캐시된 SSH가 살아있으면 새 포트 포워딩 스트림만 생성
  if (cachedSSH && sshReady) {
    try {
      const stream = await new Promise<Duplex>((resolve, reject) => {
        cachedSSH!.forwardOut(
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
      return { stream, ssh: cachedSSH };
    } catch {
      // 캐시된 SSH가 죽었으면 새로 만듦
      cachedSSH = null;
      cachedStream = null;
      sshReady = false;
    }
  }

  // 새 SSH 터널 생성
  const tunnel = await createSSHTunnel();
  cachedSSH = tunnel.ssh;
  cachedStream = tunnel.stream;
  sshReady = true;

  // SSH 연결 종료 이벤트 감지
  tunnel.ssh.on("close", () => {
    cachedSSH = null;
    cachedStream = null;
    sshReady = false;
  });

  return tunnel;
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
      idleTimeout: 60000,       // 60초 동안 안 쓰면 연결 해제
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }
  return directPool;
}

// ─── 동시 실행 제어를 위한 세마포어 ───
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
const querySemaphore = new Semaphore(useSSH ? 3 : 8);

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
  const tunnel = await getSSHTunnel();

  // SSH 터널 위에 MySQL 연결 생성
  // SSH 스트림은 재사용하지만 MySQL 연결은 매번 새로 만듦
  // (SSH 스트림 위의 MySQL 연결을 풀링하면 스트림 충돌 위험)
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_ORDER_SERVICE || "order_service",
    stream: tunnel.stream,
  });

  try {
    const [rows] = await connection.query<RowDataPacket[]>(sql, params);
    return rows as T[];
  } finally {
    await connection.end();
    // SSH는 닫지 않음 — 캐시해서 다음 쿼리에 재사용
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
