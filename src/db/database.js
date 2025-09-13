import mysql from "mysql2/promise";
import config from "./../config/env.js";


export const pool = mysql.createPool({
  host: process.env.DB_HOST || config.host,
  port: Number(process.env.DB_PORT ||config.port),
  user: process.env.DB_USER || config.user,
  password: process.env.DB_PASSWORD || config.password,
  database: process.env.DB_NAME || config.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function getConnection() {
  return pool.getConnection();
}
