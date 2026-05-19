import express from "express";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

// Database pool configuration
// For Aiven, ensure you use the full Service URI or these specific variables
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: Number(process.env.MYSQL_PORT) || 3306,
  ssl: {
    rejectUnauthorized: false // Required for secure Aiven communication
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// --- ROOMS API ---
app.get("/api/rooms", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM rooms");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/rooms/:id", async (req, res) => {
  const { status, currentCapacity } = req.body;
  try {
    await pool.query("UPDATE rooms SET status = ?, currentCapacity = ? WHERE id = ?", 
      [status, currentCapacity, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- REPORTS / MAINTENANCE API ---
app.get("/api/reports", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM reports ORDER BY date DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/reports", async (req, res) => {
  const { id, tenantId, title, details, category, status, date } = req.body;
  try {
    await pool.query(
      "INSERT INTO reports (id, tenantId, title, details, category, status, date) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, tenantId, title, details, category, status, date]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ACCOUNTS / AUTH API ---
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await pool.query("SELECT * FROM accounts WHERE username = ? AND password = ?", [username, password]);
    if (rows.length > 0) {
      res.json({ success: true, user: rows[0] });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SCHEDULES / CALENDAR API ---
app.get("/api/schedules", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM schedules");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Existing Tenant and Payment routes...
// [Include your previous /api/tenants and /api/payments routes here]

// Serve static assets from the React build
app.use(express.static(path.join(__dirname, "dist")));

// React fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
