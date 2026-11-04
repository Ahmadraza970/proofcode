const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://user:password@localhost:5432/app",
});

const API_KEY = "sk-demo-9f2c7b4a1e58d036a1b2c3d4e5f60718";

app.get("/user", async (req, res) => {
  const id = req.query.id;
  const sql = `SELECT * FROM users WHERE id = ${id}`;
  const rows = await pool.query(sql);
  res.json(rows);
});

app.get("/greet", (req, res) => {
  const name = req.query.name || "world";
  res.send(`<h1>Hello ${name}</h1>`);
});

app.post("/echo", (req, res) => {
  const message = req.body && req.body.message ? req.body.message : "";
  const output = document.getElementById("output");
  output.innerHTML = message;
  res.json({ message });
});

app.listen(3000, () => console.log("listening"));