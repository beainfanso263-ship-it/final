import dotenv from "dotenv";
import express from "express";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use((req, res, next) => {
  const allowedOrigin = process.env.CORS_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});
app.use(express.json());

app.use((req, res, next) => {
  const requestId = req.get("X-Trace-Id") || `srv-${Date.now().toString(36)}-${Math.floor(Math.random() * 900 + 100)}`;
  req.requestId = requestId;
  res.setHeader("X-Trace-Id", requestId);

  const startedAt = Date.now();
  res.on("finish", () => {
    console.log(`[${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });

  next();
});

function buildDatabaseConfig() {
  const serviceUri = process.env.MYSQL_URI || process.env.MYSQL_URL || process.env.DATABASE_URL;

  if (serviceUri) {
    const parsed = new URL(serviceUri);
    return {
      host: parsed.hostname,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ""),
      port: Number(parsed.port) || 3306,
      ssl: { rejectUnauthorized: false },
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };
  }

  return {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: Number(process.env.MYSQL_PORT) || 3306,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
}

const pool = mysql.createPool(buildDatabaseConfig());

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 90 + 10)}`;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function publicAccount(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    username: row.username,
    phone: row.phone,
    createdAt: row.createdAt,
  };
}

function normalizeOrder(row) {
  return {
    ...row,
    kilograms: Number(row.kilograms),
    ratePerKilo: Number(row.ratePerKilo),
    total: Number(row.total),
  };
}

function normalizeMachine(row) {
  return {
    ...row,
    capacityKg: Number(row.capacityKg),
  };
}

async function getCurrentPricePerKilo() {
  const [rows] = await pool.query("SELECT pricePerKilo FROM pricing WHERE id = 1 LIMIT 1");
  return Number(rows[0]?.pricePerKilo || 75);
}

// --- HEALTH / BOOTSTRAP API ---
app.get(
  "/api/health",
  asyncRoute(async (_req, res) => {
    await pool.query("SELECT 1 AS ok");
    res.json({ success: true, database: "connected" });
  }),
);

app.get(
  "/api/debug/config",
  asyncRoute(async (_req, res) => {
    res.json({
      success: true,
      api: "Washmate Express API",
      mysql: {
        hasUri: Boolean(process.env.MYSQL_URI || process.env.MYSQL_URL || process.env.DATABASE_URL),
        host: process.env.MYSQL_HOST || "from service URI",
        port: process.env.MYSQL_PORT || "from service URI or 3306",
        database: process.env.MYSQL_DATABASE || "from service URI",
        userConfigured: Boolean(process.env.MYSQL_USER || process.env.MYSQL_URI || process.env.MYSQL_URL || process.env.DATABASE_URL),
        passwordConfigured: Boolean(process.env.MYSQL_PASSWORD || process.env.MYSQL_URI || process.env.MYSQL_URL || process.env.DATABASE_URL),
      },
    });
  }),
);

app.get(
  "/api/debug/tables",
  asyncRoute(async (_req, res) => {
    const tables = [
      "accounts",
      "machines",
      "pricing",
      "orders",
      "order_status_history",
      "payments",
      "maintenance_reports",
    ];

    const counts = {};
    for (const table of tables) {
      const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM ${table}`);
      counts[table] = Number(rows[0].total);
    }

    res.json({ success: true, counts });
  }),
);

app.get(
  "/api/bootstrap",
  asyncRoute(async (_req, res) => {
    const [accounts] = await pool.query(
      "SELECT id, role, name, email, username, phone, createdAt FROM accounts ORDER BY createdAt DESC",
    );
    const [orders] = await pool.query("SELECT * FROM orders ORDER BY createdAt DESC");
    const [machines] = await pool.query("SELECT * FROM machines ORDER BY name ASC");
    const pricePerKilo = await getCurrentPricePerKilo();

    res.json({
      users: accounts.map(publicAccount),
      orders: orders.map(normalizeOrder),
      machines: machines.map(normalizeMachine),
      pricePerKilo,
    });
  }),
);

// --- ACCOUNTS / AUTH API ---
app.post(
  "/api/login",
  asyncRoute(async (req, res) => {
    const identifier = (req.body.email || req.body.username || "").trim().toLowerCase();
    const password = req.body.password || "";

    const [rows] = await pool.query(
      "SELECT id, role, name, email, username, phone, createdAt FROM accounts WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND password = ? LIMIT 1",
      [identifier, identifier, password],
    );

    if (rows.length === 0) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    res.json({ success: true, user: publicAccount(rows[0]) });
  }),
);

app.get(
  "/api/accounts",
  asyncRoute(async (_req, res) => {
    const [rows] = await pool.query(
      "SELECT id, role, name, email, username, phone, createdAt FROM accounts ORDER BY createdAt DESC",
    );
    res.json(rows.map(publicAccount));
  }),
);

app.get(
  "/api/customers",
  asyncRoute(async (_req, res) => {
    const [rows] = await pool.query(
      "SELECT id, role, name, email, username, phone, createdAt FROM accounts WHERE role = 'customer' ORDER BY createdAt DESC",
    );
    res.json(rows.map(publicAccount));
  }),
);

app.post(
  ["/api/accounts", "/api/customers", "/api/register"],
  asyncRoute(async (req, res) => {
    const id = req.body.id || makeId("cust");
    const role = req.body.role === "admin" ? "admin" : "customer";
    const name = (req.body.name || "").trim();
    const email = (req.body.email || req.body.username || "").trim().toLowerCase();
    const username = (req.body.username || email).trim().toLowerCase();
    const phone = (req.body.phone || "").trim();
    const password = req.body.password || "";

    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: "Name, email, and password are required" });
      return;
    }

    await pool.query(
      "INSERT INTO accounts (id, role, name, email, username, phone, password, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
      [id, role, name, email, username, phone, password],
    );

    const [rows] = await pool.query(
      "SELECT id, role, name, email, username, phone, createdAt FROM accounts WHERE id = ? LIMIT 1",
      [id],
    );

    res.status(201).json({ success: true, user: publicAccount(rows[0]) });
  }),
);

// --- ORDERS API ---
app.get(
  "/api/orders",
  asyncRoute(async (_req, res) => {
    const [rows] = await pool.query("SELECT * FROM orders ORDER BY createdAt DESC");
    res.json(rows.map(normalizeOrder));
  }),
);

app.get(
  "/api/orders/customer/:customerId",
  asyncRoute(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM orders WHERE customerId = ? ORDER BY createdAt DESC", [
      req.params.customerId,
    ]);
    res.json(rows.map(normalizeOrder));
  }),
);

app.post(
  "/api/orders",
  asyncRoute(async (req, res) => {
    const id = req.body.id || makeId("WM");
    const customerId = req.body.customerId;
    const kilograms = Number(req.body.kilograms);
    const ratePerKilo = Number(req.body.ratePerKilo || (await getCurrentPricePerKilo()));
    const total = Number(req.body.total || Math.round(kilograms * ratePerKilo * 100) / 100);
    const paymentMethod = req.body.paymentMethod || "Cash";
    const paymentStatus = req.body.paymentStatus || (paymentMethod === "Cash" ? "Pay on pickup" : "Paid");

    if (!customerId || !Number.isFinite(kilograms) || kilograms <= 0) {
      res.status(400).json({ success: false, message: "Customer and valid kilograms are required" });
      return;
    }

    const [[customer]] = await pool.query("SELECT name FROM accounts WHERE id = ? LIMIT 1", [customerId]);
    const customerName = req.body.customerName || customer?.name || "Walk-in customer";

    await pool.query(
      `INSERT INTO orders
        (id, customerId, customerName, kilograms, ratePerKilo, total, paymentMethod, paymentStatus, stage, status, machine, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Received', 'Pending', 'Not assigned', NOW())`,
      [id, customerId, customerName, kilograms, ratePerKilo, total, paymentMethod, paymentStatus],
    );

    await pool.query(
      "INSERT INTO order_status_history (id, orderId, stage, status, note, createdAt) VALUES (?, ?, 'Received', 'Pending', 'Order submitted', NOW())",
      [makeId("hist"), id],
    );

    const [rows] = await pool.query("SELECT * FROM orders WHERE id = ? LIMIT 1", [id]);
    res.status(201).json({ success: true, order: normalizeOrder(rows[0]) });
  }),
);

app.put(
  "/api/orders/:id/status",
  asyncRoute(async (req, res) => {
    const { stage, status, machine, paymentStatus, note } = req.body;

    await pool.query(
      `UPDATE orders
       SET stage = COALESCE(?, stage),
           status = COALESCE(?, status),
           machine = COALESCE(?, machine),
           paymentStatus = COALESCE(?, paymentStatus)
       WHERE id = ?`,
      [stage || null, status || null, machine || null, paymentStatus || null, req.params.id],
    );

    if (stage || status) {
      await pool.query(
        "INSERT INTO order_status_history (id, orderId, stage, status, note, createdAt) VALUES (?, ?, ?, ?, ?, NOW())",
        [makeId("hist"), req.params.id, stage || "Updated", status || "Updated", note || "Status updated"],
      );
    }

    const [rows] = await pool.query("SELECT * FROM orders WHERE id = ? LIMIT 1", [req.params.id]);
    res.json({ success: true, order: normalizeOrder(rows[0]) });
  }),
);

app.get(
  "/api/orders/:id/history",
  asyncRoute(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM order_status_history WHERE orderId = ? ORDER BY createdAt DESC", [
      req.params.id,
    ]);
    res.json(rows);
  }),
);

// --- MACHINES / MAINTENANCE API ---
app.get(
  "/api/machines",
  asyncRoute(async (_req, res) => {
    const [rows] = await pool.query("SELECT * FROM machines ORDER BY name ASC");
    res.json(rows.map(normalizeMachine));
  }),
);

app.post(
  "/api/machines",
  asyncRoute(async (req, res) => {
    const id = req.body.id || makeId("machine");
    const name = (req.body.name || "").trim();
    const type = req.body.type || "Washer";
    const capacityKg = Number(req.body.capacityKg || 0);
    const status = req.body.status || "Available";
    const note = req.body.note || "No note";

    if (!name || !Number.isFinite(capacityKg) || capacityKg <= 0) {
      res.status(400).json({ success: false, message: "Machine name and capacity are required" });
      return;
    }

    await pool.query(
      "INSERT INTO machines (id, name, type, capacityKg, status, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [id, name, type, capacityKg, status, note],
    );

    const [rows] = await pool.query("SELECT * FROM machines WHERE id = ? LIMIT 1", [id]);
    res.status(201).json({ success: true, machine: normalizeMachine(rows[0]) });
  }),
);

app.put(
  "/api/machines/:id",
  asyncRoute(async (req, res) => {
    const { name, type, capacityKg, status, note } = req.body;

    await pool.query(
      `UPDATE machines
       SET name = COALESCE(?, name),
           type = COALESCE(?, type),
           capacityKg = COALESCE(?, capacityKg),
           status = COALESCE(?, status),
           note = COALESCE(?, note),
           updatedAt = NOW()
       WHERE id = ?`,
      [name || null, type || null, capacityKg || null, status || null, note || null, req.params.id],
    );

    const [rows] = await pool.query("SELECT * FROM machines WHERE id = ? LIMIT 1", [req.params.id]);
    res.json({ success: true, machine: normalizeMachine(rows[0]) });
  }),
);

app.put(
  "/api/machines/:id/status",
  asyncRoute(async (req, res) => {
    const { status, note } = req.body;
    await pool.query("UPDATE machines SET status = ?, note = COALESCE(?, note), updatedAt = NOW() WHERE id = ?", [
      status,
      note || null,
      req.params.id,
    ]);

    if (status === "Maintenance") {
      await pool.query(
        "INSERT INTO maintenance_reports (id, machineId, title, details, category, status, date) VALUES (?, ?, ?, ?, 'Machine', 'Open', NOW())",
        [makeId("mnt"), req.params.id, "Machine marked for maintenance", note || "Needs maintenance check"],
      );
    }

    const [rows] = await pool.query("SELECT * FROM machines WHERE id = ? LIMIT 1", [req.params.id]);
    res.json({ success: true, machine: normalizeMachine(rows[0]) });
  }),
);

app.get(
  "/api/reports",
  asyncRoute(async (_req, res) => {
    const [rows] = await pool.query("SELECT * FROM maintenance_reports ORDER BY date DESC");
    res.json(rows);
  }),
);

app.post(
  "/api/reports",
  asyncRoute(async (req, res) => {
    const id = req.body.id || makeId("mnt");
    const { machineId, title, details, category, status } = req.body;

    await pool.query(
      "INSERT INTO maintenance_reports (id, machineId, title, details, category, status, date) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [id, machineId || null, title, details, category || "Machine", status || "Open"],
    );

    res.status(201).json({ success: true, id });
  }),
);

// --- PRICING API ---
app.get(
  "/api/pricing",
  asyncRoute(async (_req, res) => {
    res.json({ pricePerKilo: await getCurrentPricePerKilo() });
  }),
);

app.put(
  "/api/pricing",
  asyncRoute(async (req, res) => {
    const pricePerKilo = Number(req.body.pricePerKilo);

    if (!Number.isFinite(pricePerKilo) || pricePerKilo <= 0) {
      res.status(400).json({ success: false, message: "A valid pricePerKilo is required" });
      return;
    }

    await pool.query(
      "INSERT INTO pricing (id, pricePerKilo, updatedAt) VALUES (1, ?, NOW()) ON DUPLICATE KEY UPDATE pricePerKilo = VALUES(pricePerKilo), updatedAt = NOW()",
      [pricePerKilo],
    );

    res.json({ success: true, pricePerKilo });
  }),
);

// --- PAYMENTS API ---
app.get(
  "/api/payments",
  asyncRoute(async (_req, res) => {
    const [rows] = await pool.query("SELECT * FROM payments ORDER BY paidAt DESC");
    res.json(rows);
  }),
);

app.post(
  "/api/payments",
  asyncRoute(async (req, res) => {
    const id = req.body.id || makeId("pay");
    const { orderId, customerId, amount, method, status, referenceNo } = req.body;

    await pool.query(
      "INSERT INTO payments (id, orderId, customerId, amount, method, status, referenceNo, paidAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
      [id, orderId, customerId, amount, method || "Cash", status || "Paid", referenceNo || null],
    );

    if (orderId) {
      await pool.query("UPDATE orders SET paymentStatus = ? WHERE id = ?", [status || "Paid", orderId]);
    }

    res.status(201).json({ success: true, id });
  }),
);

// Serve static assets from the React build.
app.use(express.static(path.join(__dirname, "dist")));

// React fallback for client-side routing.
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.use((err, req, res, _next) => {
  console.error(err);
  const status = err.code === "ER_DUP_ENTRY" ? 409 : 500;
  res.status(status).json({ success: false, error: err.message, traceId: req.requestId });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
