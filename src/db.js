import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";
import { seedDefaultContent } from "./seed.js";

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new DatabaseSync(config.databasePath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_page TEXT NOT NULL,
    full_name TEXT,
    email TEXT NOT NULL,
    phone_number TEXT,
    select_service TEXT,
    budget_range TEXT,
    inquiry TEXT,
    consent INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category_name TEXT NOT NULL,
    intro TEXT NOT NULL,
    description TEXT,
    link TEXT,
    banner TEXT NOT NULL,
    tags TEXT,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    path TEXT NOT NULL,
    alt_text TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_project_images_project_id ON project_images(project_id, sort_order, id);

  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    bio TEXT,
    profile TEXT NOT NULL,
    github TEXT,
    twitter TEXT,
    linkedin TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    path TEXT NOT NULL,
    referrer TEXT,
    country_code TEXT,
    device_type TEXT,
    device_name TEXT,
    browser TEXT,
    operating_system TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);
  CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON page_views(session_id);
  CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
`);

const pageViewColumns = new Set(db.prepare("PRAGMA table_info(page_views)").all().map((column) => column.name));
for (const [name, type] of [
  ["country_code", "TEXT"],
  ["device_type", "TEXT"],
  ["device_name", "TEXT"],
  ["browser", "TEXT"],
  ["operating_system", "TEXT"],
]) {
  if (!pageViewColumns.has(name)) db.exec(`ALTER TABLE page_views ADD COLUMN ${name} ${type}`);
}

const projectColumns = new Set(db.prepare("PRAGMA table_info(projects)").all().map((column) => column.name));
for (const name of [
  "title_en", "title_fa", "category_name_en", "category_name_fa", "intro_en", "intro_fa",
  "description_en", "description_fa", "tags_en", "tags_fa", "challenge_en", "challenge_fa",
  "solution_en", "solution_fa", "outcome_en", "outcome_fa", "duration_en", "duration_fa",
  "team_role_en", "team_role_fa", "results_en", "results_fa", "testimonial_quote_en",
  "testimonial_quote_fa", "testimonial_name_en", "testimonial_name_fa", "testimonial_role_en",
  "testimonial_role_fa",
]) {
  if (!projectColumns.has(name)) db.exec(`ALTER TABLE projects ADD COLUMN ${name} TEXT`);
}

const teamMemberColumns = new Set(db.prepare("PRAGMA table_info(team_members)").all().map((column) => column.name));
for (const name of ["name_en", "name_fa", "position_en", "position_fa", "bio_en", "bio_fa"]) {
  if (!teamMemberColumns.has(name)) db.exec(`ALTER TABLE team_members ADD COLUMN ${name} TEXT`);
}

export const seedResult = seedDefaultContent(db, config);

export function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

export function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

export function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}
