import { Client as SSHClient } from "ssh2";
import mysql, { type RowDataPacket } from "mysql2/promise";
import fs from "fs";
import path from "path";
import type { Duplex } from "stream";

function getSSHPrivateKey(): string | Buffer {
  // 1순위: 환경변수 (Vercel 배포 환경)
  if (process.env.SSH_PRIVATE_KEY) {
    return process.env.SSH_PRIVATE_KEY;
  }
  // 2순위: 파일 (로컬 개발 환경)
  const keyPath = path.resolve(process.env.SSH_KEY_PATH || "test.pem");
  return fs.readFileSync(keyPath);
}

function createSSHStream(): Promise<{ stream: Duplex; ssh: SSHClient }> {
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

export async function queryMySQL<T = RowDataPacket>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const useSSH = !!(process.env.SSH_HOST && (process.env.SSH_PRIVATE_KEY || process.env.SSH_KEY_PATH));
  let connection: mysql.Connection;
  let ssh: SSHClient | null = null;

  if (useSSH) {
    const tunnel = await createSSHStream();
    ssh = tunnel.ssh;
    connection = await mysql.createConnection({
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      database: process.env.DB_ORDER_SERVICE || "order_service",
      stream: tunnel.stream,
    });
  } else {
    // SSH 없이 직접 연결 (VPC 내부 등)
    connection = await mysql.createConnection({
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      database: process.env.DB_ORDER_SERVICE || "order_service",
    });
  }

  try {
    const [rows] = await connection.query<RowDataPacket[]>(sql, params);
    return rows as T[];
  } finally {
    await connection.end();
    if (ssh) ssh.end();
  }
}
