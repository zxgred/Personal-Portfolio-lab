// backend/server.js - Personal Portfolio: Node.js + Express + MySQL (XAMPP)
// Flow: Frontend (jQuery AJAX) -> Express -> MySQL -> JSON / image -> Frontend

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = 3000;

// ---------- MySQL connection (XAMPP defaults: user root, empty password) ----------
const dbConfig = {
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: ""             // <-- XAMPP root has no password by default
};
const DB_NAME = "portfolio_db";

const pool = mysql.createPool({
  ...dbConfig,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// ---------- Create the database and tables automatically ----------
async function initDatabase() {
  const conn = await mysql.createConnection(dbConfig);
  await conn.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4`);
  try {
    // allow images up to 16 MB to be saved (XAMPP's default limit can be small)
    await conn.query("SET GLOBAL max_allowed_packet = 16777216");
  } catch (e) { /* ignore: not allowed on some setups */ }
  await conn.end();

  await pool.query(`CREATE TABLE IF NOT EXISTS profile (
    id INT UNSIGNED NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    title VARCHAR(100) NOT NULL,
    tagline VARCHAR(255) NOT NULL DEFAULT '',
    about TEXT NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL DEFAULT '',
    location VARCHAR(100) NOT NULL DEFAULT '',
    github VARCHAR(255) NOT NULL DEFAULT '',
    linkedin VARCHAR(255) NOT NULL DEFAULT '',
    image LONGBLOB NULL,
    image_type VARCHAR(50) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB`);

  await pool.query(`CREATE TABLE IF NOT EXISTS skills (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(60) NOT NULL,
    level TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB`);

  await pool.query(`CREATE TABLE IF NOT EXISTS education (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    degree VARCHAR(150) NOT NULL,
    institution VARCHAR(150) NOT NULL,
    start_year VARCHAR(4) NOT NULL,
    end_year VARCHAR(4) NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB`);

  await pool.query(`CREATE TABLE IF NOT EXISTS experience (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    role VARCHAR(150) NOT NULL,
    company VARCHAR(150) NOT NULL,
    start_year VARCHAR(4) NOT NULL,
    end_year VARCHAR(4) NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB`);

  await pool.query(`CREATE TABLE IF NOT EXISTS projects (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    tech VARCHAR(255) NOT NULL DEFAULT '',
    link VARCHAR(255) NOT NULL DEFAULT '',
    image LONGBLOB NULL,
    image_type VARCHAR(50) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB`);

  console.log("Database ready:", DB_NAME);
}

// ---------- Middleware ----------
// Custom middleware: print the method and URL of every request
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});
app.use(cors());          // lets the page work even if opened from another port (Live Server)
app.use(express.json());  // JSON request bodies -> req.body
app.use(express.static(path.join(__dirname, "..", "frontend"))); // serves the website

// ---------- Image upload (kept in memory, then saved into MySQL) ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
    cb(ok ? null : new Error("Only JPG, PNG, WEBP or GIF images are allowed."), ok);
  }
});

function uploadImage(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (err) {
      const message = err.code === "LIMIT_FILE_SIZE" ? "Image is too large. Maximum size is 2 MB." : err.message;
      return res.status(400).json({ success: false, message });
    }
    next();
  });
}

// ---------- Validation ----------
// Each field: name, label, required, max length, optional type (year / level / email / url)
const PROFILE_FIELDS = [
  { name: "full_name", label: "Full name", required: true, max: 100 },
  { name: "title", label: "Professional title", required: true, max: 100 },
  { name: "tagline", label: "Tagline", max: 255 },
  { name: "about", label: "About me", required: true, max: 2000 },
  { name: "email", label: "Email", required: true, max: 150, type: "email" },
  { name: "phone", label: "Phone", max: 30 },
  { name: "location", label: "Location", max: 100 },
  { name: "github", label: "GitHub link", max: 255, type: "url" },
  { name: "linkedin", label: "LinkedIn link", max: 255, type: "url" }
];
const SKILL_FIELDS = [
  { name: "name", label: "Skill name", required: true, max: 60 },
  { name: "level", label: "Level", required: true, type: "level" }
];
const EDUCATION_FIELDS = [
  { name: "degree", label: "Degree", required: true, max: 150 },
  { name: "institution", label: "Institution", required: true, max: 150 },
  { name: "start_year", label: "Start year", required: true, type: "year" },
  { name: "end_year", label: "End year", type: "year" },
  { name: "description", label: "Description", max: 1000 }
];
const EXPERIENCE_FIELDS = [
  { name: "role", label: "Role", required: true, max: 150 },
  { name: "company", label: "Company", required: true, max: 150 },
  { name: "start_year", label: "Start year", required: true, type: "year" },
  { name: "end_year", label: "End year", type: "year" },
  { name: "description", label: "Description", max: 1000 }
];
const PROJECT_FIELDS = [
  { name: "title", label: "Project title", required: true, max: 150 },
  { name: "description", label: "Description", required: true, max: 1000 },
  { name: "tech", label: "Technologies", max: 255 },
  { name: "link", label: "Project link", max: 255, type: "url" }
];

// Checks req.body against a field list. Returns { values } or { error }.
function cleanFields(body, fields) {
  const values = {};
  for (const f of fields) {
    const v = body[f.name] == null ? "" : String(body[f.name]).trim();
    if (f.required && v === "") return { error: `${f.label} is required.` };
    if (v.length > (f.max || 255)) return { error: `${f.label} is too long (max ${f.max || 255} characters).` };

    if (f.type === "level") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 100) return { error: "Level must be a whole number from 0 to 100." };
      values[f.name] = n;
      continue;
    }
    if (f.type === "year" && v !== "" && !/^\d{4}$/.test(v)) return { error: `${f.label} must be a 4-digit year.` };
    if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { error: "Please enter a valid email address." };
    if (f.type === "url" && v !== "" && !/^https?:\/\//i.test(v)) return { error: `${f.label} must start with http:// or https://` };
    values[f.name] = v;
  }
  return { values };
}

function serverError(res, err, message) {
  console.error(message, "-", err.message);
  res.status(500).json({ success: false, message });
}

// ---------- GET /api/portfolio : everything the page needs (no image data) ----------
app.get("/api/portfolio", async (req, res) => {
  try {
    const [profiles] = await pool.query(
      `SELECT id, full_name, title, tagline, about, email, phone, location, github, linkedin,
              (image IS NOT NULL) AS has_image, updated_at FROM profile WHERE id = 1`
    );
    const [skills] = await pool.query("SELECT id, name, level FROM skills ORDER BY level DESC, id");
    const [education] = await pool.query("SELECT * FROM education ORDER BY start_year DESC, id DESC");
    const [experience] = await pool.query("SELECT * FROM experience ORDER BY start_year DESC, id DESC");
    const [projects] = await pool.query(
      "SELECT id, title, description, tech, link, (image IS NOT NULL) AS has_image, updated_at FROM projects ORDER BY id DESC"
    );
    const profile = profiles.length ? { ...profiles[0], has_image: Boolean(profiles[0].has_image) } : null;
    res.json({
      profile,
      skills,
      education,
      experience,
      projects: projects.map((p) => ({ ...p, has_image: Boolean(p.has_image) }))
    });
  } catch (err) {
    serverError(res, err, "Could not read the portfolio from the database.");
  }
});

// ---------- PROFILE ----------
// POST /api/profile : first-time setup (creates the profile)
app.post("/api/profile", uploadImage, async (req, res) => {
  const { values, error } = cleanFields(req.body, PROFILE_FIELDS);
  if (error) return res.status(400).json({ success: false, message: error });

  try {
    const [existing] = await pool.query("SELECT id FROM profile WHERE id = 1");
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "A profile already exists. Use edit instead." });
    }
    const cols = Object.keys(values);
    const params = cols.map((c) => values[c]);
    let sql = `INSERT INTO profile (id, ${cols.join(", ")}`;
    let marks = "1, " + cols.map(() => "?").join(", ");
    if (req.file) {
      sql += ", image, image_type";
      marks += ", ?, ?";
      params.push(req.file.buffer, req.file.mimetype);
    }
    await pool.query(`${sql}) VALUES (${marks})`, params);
    res.status(201).json({ success: true, message: "Your portfolio has been created!" });
  } catch (err) {
    serverError(res, err, "Could not create the profile.");
  }
});

// PUT /api/profile : edit the profile (optional new photo, or remove the photo)
app.put("/api/profile", uploadImage, async (req, res) => {
  const { values, error } = cleanFields(req.body, PROFILE_FIELDS);
  if (error) return res.status(400).json({ success: false, message: error });

  try {
    const cols = Object.keys(values);
    const sets = cols.map((c) => `${c} = ?`);
    const params = cols.map((c) => values[c]);
    if (req.file) {
      sets.push("image = ?", "image_type = ?");
      params.push(req.file.buffer, req.file.mimetype);
    } else if (req.body.remove_image === "1") {
      sets.push("image = NULL", "image_type = NULL");
    }
    const [result] = await pool.query(`UPDATE profile SET ${sets.join(", ")} WHERE id = 1`, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Profile not found." });
    }
    res.json({ success: true, message: "Profile updated." });
  } catch (err) {
    serverError(res, err, "Could not update the profile.");
  }
});

// GET /api/profile/image : sends the profile photo stored in MySQL
app.get("/api/profile/image", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT image, image_type FROM profile WHERE id = 1");
    if (rows.length === 0 || !rows[0].image) return res.status(404).send("No image");
    res.set("Content-Type", rows[0].image_type);
    res.set("Cache-Control", "no-cache");
    res.send(rows[0].image);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// ---------- Simple CRUD for skills, education and experience ----------
function registerCrud(route, table, fields) {
  const cols = fields.map((f) => f.name); // column names come from our own list, not from the user

  app.post(`/api/${route}`, async (req, res) => {
    const { values, error } = cleanFields(req.body, fields);
    if (error) return res.status(400).json({ success: false, message: error });
    try {
      const [result] = await pool.query(
        `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
        cols.map((c) => values[c])
      );
      res.status(201).json({ success: true, message: "Added successfully.", id: result.insertId });
    } catch (err) {
      serverError(res, err, "Could not add the item.");
    }
  });

  app.put(`/api/${route}/:id`, async (req, res) => {
    const id = Number(req.params.id);
    const { values, error } = cleanFields(req.body, fields);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: "Invalid id." });
    if (error) return res.status(400).json({ success: false, message: error });
    try {
      const [result] = await pool.query(
        `UPDATE ${table} SET ${cols.map((c) => c + " = ?").join(", ")} WHERE id = ?`,
        [...cols.map((c) => values[c]), id]
      );
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Item not found." });
      res.json({ success: true, message: "Updated successfully." });
    } catch (err) {
      serverError(res, err, "Could not update the item.");
    }
  });

  app.delete(`/api/${route}/:id`, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: "Invalid id." });
    try {
      const [result] = await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Item not found." });
      res.json({ success: true, message: "Deleted successfully." });
    } catch (err) {
      serverError(res, err, "Could not delete the item.");
    }
  });
}

registerCrud("skills", "skills", SKILL_FIELDS);
registerCrud("education", "education", EDUCATION_FIELDS);
registerCrud("experience", "experience", EXPERIENCE_FIELDS);

// ---------- PROJECTS (with optional image) ----------
app.post("/api/projects", uploadImage, async (req, res) => {
  const { values, error } = cleanFields(req.body, PROJECT_FIELDS);
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    await pool.query(
      "INSERT INTO projects (title, description, tech, link, image, image_type) VALUES (?, ?, ?, ?, ?, ?)",
      [values.title, values.description, values.tech, values.link,
       req.file ? req.file.buffer : null, req.file ? req.file.mimetype : null]
    );
    res.status(201).json({ success: true, message: "Project added." });
  } catch (err) {
    serverError(res, err, "Could not add the project.");
  }
});

app.put("/api/projects/:id", uploadImage, async (req, res) => {
  const id = Number(req.params.id);
  const { values, error } = cleanFields(req.body, PROJECT_FIELDS);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: "Invalid id." });
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    const sets = ["title = ?", "description = ?", "tech = ?", "link = ?"];
    const params = [values.title, values.description, values.tech, values.link];
    if (req.file) {
      sets.push("image = ?", "image_type = ?");
      params.push(req.file.buffer, req.file.mimetype);
    } else if (req.body.remove_image === "1") {
      sets.push("image = NULL", "image_type = NULL");
    }
    const [result] = await pool.query(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Project not found." });
    res.json({ success: true, message: "Project updated." });
  } catch (err) {
    serverError(res, err, "Could not update the project.");
  }
});

app.delete("/api/projects/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, message: "Invalid id." });
  try {
    const [result] = await pool.query("DELETE FROM projects WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Project not found." });
    res.json({ success: true, message: "Project deleted." });
  } catch (err) {
    serverError(res, err, "Could not delete the project.");
  }
});

app.get("/api/projects/:id/image", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT image, image_type FROM projects WHERE id = ?", [Number(req.params.id)]);
    if (rows.length === 0 || !rows[0].image) return res.status(404).send("No image");
    res.set("Content-Type", rows[0].image_type);
    res.set("Cache-Control", "no-cache");
    res.send(rows[0].image);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// ---------- DELETE /api/portfolio : remove everything (start again) ----------
app.delete("/api/portfolio", async (req, res) => {
  try {
    for (const table of ["skills", "education", "experience", "projects", "profile"]) {
      await pool.query(`DELETE FROM ${table}`);
    }
    res.json({ success: true, message: "Portfolio deleted. You can set it up again." });
  } catch (err) {
    serverError(res, err, "Could not reset the portfolio.");
  }
});

// Unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "API route not found." });
});

// ---------- Start: prepare the database first, then listen ----------
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Portfolio running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Could not connect to MySQL:", err.message);
    console.error("Start MySQL in the XAMPP Control Panel, then run the server again.");
    process.exit(1);
  });
