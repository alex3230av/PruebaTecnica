import { config } from "dotenv";

config();

export default {
    host: process.env.HOST || "localhost",
    port: Number(process.env.PORT) || 3306,
    database: process.env.DATABASE || "",
    user: process.env.USER || "",
    password: process.env.PASSWORD || ""
}