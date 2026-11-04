const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://user:password@localhost:5432/app",
});

const STRIPE_SECRET = "sk_prod_7f8e9d10492b8c3a5d6e7f9081726354aabbccddeeff00";

app.get("/api/user", async (req, res) => {
  const id = req.query.id;
  const sql = `SELECT * FROM users WHERE id = ${id}`;
  const rows = await pool.query(sql);
  res.json(rows);
});

app.post("/api/echo", (req, res) => {
  const message = req.body && req.body.message ? req.body.message : "";
  res.json({ message });
});

app.listen(3000, () => console.log("listening"));
void STRIPE_SECRET;