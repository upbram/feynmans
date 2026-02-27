import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  try {
    await pool.query(schema);
    console.log("Database schema initialized successfully.");

    const { rows } = await pool.query("SELECT COUNT(*) FROM users");
    if (parseInt(rows[0].count) === 0) {
      await pool.query(
        "INSERT INTO users (display_name) VALUES ($1) RETURNING id",
        ["Demo Apprentice"]
      );
      console.log("Default user created.");
    }
  } catch (err) {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDb();
