import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { config } from "./config.js";
import { describeVisit } from "./analytics.js";
import { all, get, run } from "./db.js";
import { analyticsVisitSchema, normalizeSubmission, projectImageSchema, projectSchema, submissionSchema, teamSchema } from "./validation.js";

fs.mkdirSync(config.uploadDir, { recursive: true });

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const extensionByMime = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_request, file, callback) => {
      callback(null, `${Date.now()}-${crypto.randomUUID()}${extensionByMime[file.mimetype] || ""}`);
    },
  }),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_request, file, callback) => {
    callback(allowedMimeTypes.has(file.mimetype) ? null : new Error("Unsupported image type"), allowedMimeTypes.has(file.mimetype));
  },
});

function adminOnly(request, response, next) {
  if (!config.adminApiKey) return response.status(503).json({ status: "error", message: "Admin API is not configured" });
  const supplied = request.get("x-admin-api-key") || "";
  const expected = Buffer.from(config.adminApiKey);
  const actual = Buffer.from(supplied);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return response.status(401).json({ status: "error", message: "Unauthorized" });
  }
  next();
}

function parse(schema, body, response) {
  const result = schema.safeParse(body);
  if (!result.success) {
    response.status(422).json({ status: "error", message: "Validation failed", errors: result.error.flatten() });
    return null;
  }
  return result.data;
}

function projectWithGallery(project) {
  if (!project) return null;
  return {
    ...project,
    gallery: all("SELECT id, path, alt_text, sort_order FROM project_images WHERE project_id = ? ORDER BY sort_order, id", [project.id]),
  };
}

const projectContentFields = [
  "title_en", "title_fa", "category_name_en", "category_name_fa", "intro_en", "intro_fa",
  "description_en", "description_fa", "tags_en", "tags_fa", "challenge_en", "challenge_fa",
  "solution_en", "solution_fa", "outcome_en", "outcome_fa", "duration_en", "duration_fa",
  "team_role_en", "team_role_fa", "results_en", "results_fa", "testimonial_quote_en",
  "testimonial_quote_fa", "testimonial_name_en", "testimonial_name_fa", "testimonial_role_en",
  "testimonial_role_fa",
];

function updateProjectContent(projectId, data) {
  const assignments = projectContentFields.map((field) => `${field} = ?`).join(", ");
  const values = projectContentFields.map((field) => data[field] || null);
  run(`UPDATE projects SET ${assignments} WHERE id = ?`, [...values, projectId]);
}

function updateTeamContent(memberId, data) {
  run(
    `UPDATE team_members SET name_en = ?, name_fa = ?, position_en = ?, position_fa = ?, bio_en = ?, bio_fa = ? WHERE id = ?`,
    [data.name_en || null, data.name_fa || null, data.position_en || null, data.position_fa || null, data.bio_en || null, data.bio_fa || null, memberId]
  );
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: config.corsOrigins, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], allowedHeaders: ["Content-Type", "x-admin-api-key"] }));
  app.use(express.json({ limit: "100kb" }));
  app.use("/uploads", express.static(config.uploadDir, { fallthrough: false, maxAge: "7d" }));

  app.get("/api/health", (_request, response) => response.json({ status: "ok" }));

  app.use("/api/analytics/visit", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false }));
  app.post("/api/analytics/visit", (request, response) => {
    const data = parse(analyticsVisitSchema, request.body, response);
    if (!data) return;

    const duplicate = get(
      `SELECT id FROM page_views
       WHERE session_id = ? AND path = ? AND created_at >= datetime('now', '-5 seconds')
       LIMIT 1`,
      [data.session_id, data.path]
    );
    if (!duplicate) {
      const visit = describeVisit(request, config.trustProxy);
      run(
        `INSERT INTO page_views
         (session_id, path, referrer, country_code, device_type, device_name, browser, operating_system)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.session_id, data.path, data.referrer || null, visit.countryCode, visit.deviceType, visit.deviceName, visit.browser, visit.operatingSystem]
      );
    }
    response.status(204).end();
  });

  app.use("/api/project-request", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false }));
  app.post("/api/project-request/", (request, response) => {
    const data = parse(submissionSchema, normalizeSubmission(request.body), response);
    if (!data) return;
    const result = run(
      `INSERT INTO submissions (form_page, full_name, email, phone_number, select_service, budget_range, inquiry, consent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.form_page, data.full_name || null, data.email, data.phone_number || null, data.select_service || null, data.budget_range || null, data.inquiry || null, data.consent ? 1 : 0]
    );
    response.status(201).json({ status: "200", message: "Your request was received successfully.", data: { id: Number(result.lastInsertRowid) } });
  });

  app.get("/api/projects", (_request, response) => response.json({ status: 200, data: all("SELECT * FROM projects WHERE is_published = 1 ORDER BY created_at DESC") }));
  app.get("/api/last-projects/:limit", (request, response) => {
    const limit = Math.min(Math.max(Number(request.params.limit) || 2, 1), 20);
    response.json({ status: 200, data: all("SELECT * FROM projects WHERE is_published = 1 ORDER BY created_at DESC LIMIT ?", [limit]) });
  });
  app.get("/api/projects/:id", (request, response) => {
    const project = get("SELECT * FROM projects WHERE id = ? AND is_published = 1", [Number(request.params.id)]);
    if (!project) return response.status(404).json({ status: "error", message: "Project not found" });
    response.json({ status: 200, data: projectWithGallery(project) });
  });
  app.get("/api/our-team", (_request, response) => response.json({ status: 200, data: all("SELECT * FROM team_members WHERE is_published = 1 ORDER BY sort_order, id") }));

  app.post("/api/admin/uploads", adminOnly, upload.single("image"), (request, response) => {
    if (!request.file) return response.status(400).json({ status: "error", message: "Image is required" });
    response.status(201).json({ status: 201, data: { path: `/uploads/${request.file.filename}` } });
  });

  app.get("/api/admin/stats", adminOnly, (_request, response) => {
    const summary = {
      projects: Number(get("SELECT COUNT(*) AS count FROM projects")?.count || 0),
      publishedProjects: Number(get("SELECT COUNT(*) AS count FROM projects WHERE is_published = 1")?.count || 0),
      teamMembers: Number(get("SELECT COUNT(*) AS count FROM team_members")?.count || 0),
      submissions: Number(get("SELECT COUNT(*) AS count FROM submissions")?.count || 0),
      newSubmissions: Number(get("SELECT COUNT(*) AS count FROM submissions WHERE status = 'new'")?.count || 0),
      todaySubmissions: Number(get("SELECT COUNT(*) AS count FROM submissions WHERE date(created_at, 'localtime') = date('now', 'localtime')")?.count || 0),
      uploads: fs.readdirSync(config.uploadDir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name !== ".gitkeep").length,
      pageViews: Number(get("SELECT COUNT(*) AS count FROM page_views")?.count || 0),
      uniqueSessions: Number(get("SELECT COUNT(DISTINCT session_id) AS count FROM page_views")?.count || 0),
      todayPageViews: Number(get("SELECT COUNT(*) AS count FROM page_views WHERE date(created_at, 'localtime') = date('now', 'localtime')")?.count || 0),
    };
    const activity = all(`
      WITH RECURSIVE dates(day) AS (
        SELECT date('now', 'localtime', '-6 days')
        UNION ALL SELECT date(day, '+1 day') FROM dates WHERE day < date('now', 'localtime')
      )
      SELECT dates.day, COUNT(submissions.id) AS count
      FROM dates LEFT JOIN submissions ON date(submissions.created_at, 'localtime') = dates.day
      GROUP BY dates.day ORDER BY dates.day
    `).map((item) => ({ ...item, count: Number(item.count) }));
    const recent = all("SELECT * FROM submissions ORDER BY created_at DESC LIMIT 6");
    const traffic = all(`
      WITH RECURSIVE dates(day) AS (
        SELECT date('now', 'localtime', '-6 days')
        UNION ALL SELECT date(day, '+1 day') FROM dates WHERE day < date('now', 'localtime')
      )
      SELECT dates.day, COUNT(page_views.id) AS count, COUNT(DISTINCT page_views.session_id) AS sessions
      FROM dates LEFT JOIN page_views ON date(page_views.created_at, 'localtime') = dates.day
      GROUP BY dates.day ORDER BY dates.day
    `).map((item) => ({ ...item, count: Number(item.count), sessions: Number(item.sessions) }));
    const topPages = all(`
      SELECT path, COUNT(*) AS views, COUNT(DISTINCT session_id) AS sessions
      FROM page_views GROUP BY path ORDER BY views DESC, path ASC LIMIT 8
    `).map((item) => ({ ...item, views: Number(item.views), sessions: Number(item.sessions) }));
    const referrers = all(`
      SELECT referrer, COUNT(*) AS views
      FROM page_views WHERE referrer IS NOT NULL AND referrer != ''
      GROUP BY referrer ORDER BY views DESC LIMIT 8
    `).map((item) => ({ ...item, views: Number(item.views) }));
    const countries = all(`
      SELECT COALESCE(country_code, 'ZZ') AS label, COUNT(*) AS views, COUNT(DISTINCT session_id) AS sessions
      FROM page_views GROUP BY label ORDER BY views DESC LIMIT 12
    `).map((item) => ({ ...item, views: Number(item.views), sessions: Number(item.sessions) }));
    const devices = all(`
      SELECT COALESCE(device_type, 'unknown') AS label, COUNT(*) AS views, COUNT(DISTINCT session_id) AS sessions
      FROM page_views GROUP BY label ORDER BY views DESC
    `).map((item) => ({ ...item, views: Number(item.views), sessions: Number(item.sessions) }));
    const browsers = all(`
      SELECT COALESCE(browser, 'Unknown') AS label, COUNT(*) AS views
      FROM page_views GROUP BY label ORDER BY views DESC LIMIT 10
    `).map((item) => ({ ...item, views: Number(item.views) }));
    const operatingSystems = all(`
      SELECT COALESCE(operating_system, 'Unknown') AS label, COUNT(*) AS views
      FROM page_views GROUP BY label ORDER BY views DESC LIMIT 10
    `).map((item) => ({ ...item, views: Number(item.views) }));
    const recentVisits = all(`
      SELECT path, country_code, device_type, device_name, browser, operating_system, created_at
      FROM page_views ORDER BY created_at DESC, id DESC LIMIT 12
    `);
    response.json({ status: 200, data: { summary, activity, traffic, topPages, referrers, countries, devices, browsers, operatingSystems, recentVisits, recent } });
  });

  app.get("/api/admin/projects", adminOnly, (_request, response) => {
    response.json({ status: 200, data: all(`
      SELECT projects.*, COUNT(project_images.id) AS gallery_count
      FROM projects
      LEFT JOIN project_images ON project_images.project_id = projects.id
      GROUP BY projects.id
      ORDER BY projects.created_at DESC
    `) });
  });

  app.get("/api/admin/team", adminOnly, (_request, response) => {
    response.json({ status: 200, data: all("SELECT * FROM team_members ORDER BY sort_order, id") });
  });

  app.post("/api/admin/projects", adminOnly, (request, response) => {
    const data = parse(projectSchema, request.body, response);
    if (!data) return;
    const result = run(
      `INSERT INTO projects (title, category_name, intro, description, link, banner, tags, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.title, data.category_name, data.intro, data.description || null, data.link || null, data.banner, data.tags || null, data.is_published ? 1 : 0]
    );
    const projectId = Number(result.lastInsertRowid);
    updateProjectContent(projectId, data);
    response.status(201).json({ status: 201, data: get("SELECT * FROM projects WHERE id = ?", [projectId]) });
  });

  app.put("/api/admin/projects/:id", adminOnly, (request, response) => {
    const data = parse(projectSchema, request.body, response);
    if (!data) return;
    const result = run(
      `UPDATE projects SET title = ?, category_name = ?, intro = ?, description = ?, link = ?, banner = ?, tags = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [data.title, data.category_name, data.intro, data.description || null, data.link || null, data.banner, data.tags || null, data.is_published ? 1 : 0, Number(request.params.id)]
    );
    if (!result.changes) return response.status(404).json({ status: "error", message: "Project not found" });
    updateProjectContent(Number(request.params.id), data);
    response.json({ status: 200, data: get("SELECT * FROM projects WHERE id = ?", [Number(request.params.id)]) });
  });

  app.get("/api/admin/projects/:id/images", adminOnly, (request, response) => {
    const projectId = Number(request.params.id);
    if (!get("SELECT id FROM projects WHERE id = ?", [projectId])) return response.status(404).json({ status: "error", message: "Project not found" });
    response.json({ status: 200, data: all("SELECT * FROM project_images WHERE project_id = ? ORDER BY sort_order, id", [projectId]) });
  });

  app.post("/api/admin/projects/:id/images", adminOnly, (request, response) => {
    const projectId = Number(request.params.id);
    if (!get("SELECT id FROM projects WHERE id = ?", [projectId])) return response.status(404).json({ status: "error", message: "Project not found" });
    const data = parse(projectImageSchema, request.body, response);
    if (!data) return;
    const result = run(
      "INSERT INTO project_images (project_id, path, alt_text, sort_order) VALUES (?, ?, ?, ?)",
      [projectId, data.path, data.alt_text || null, data.sort_order]
    );
    response.status(201).json({ status: 201, data: get("SELECT * FROM project_images WHERE id = ?", [Number(result.lastInsertRowid)]) });
  });

  app.delete("/api/admin/projects/:id/images/:imageId", adminOnly, (request, response) => {
    const result = run("DELETE FROM project_images WHERE id = ? AND project_id = ?", [Number(request.params.imageId), Number(request.params.id)]);
    if (!result.changes) return response.status(404).json({ status: "error", message: "Project image not found" });
    response.status(204).end();
  });

  app.delete("/api/admin/projects/:id", adminOnly, (request, response) => {
    const result = run("DELETE FROM projects WHERE id = ?", [Number(request.params.id)]);
    if (!result.changes) return response.status(404).json({ status: "error", message: "Project not found" });
    response.status(204).end();
  });

  app.post("/api/admin/team", adminOnly, (request, response) => {
    const data = parse(teamSchema, request.body, response);
    if (!data) return;
    const result = run(
      `INSERT INTO team_members (name, position, bio, profile, github, twitter, linkedin, sort_order, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.name, data.position, data.bio || null, data.profile, data.github || null, data.twitter || null, data.linkedin || null, data.sort_order, data.is_published ? 1 : 0]
    );
    const memberId = Number(result.lastInsertRowid);
    updateTeamContent(memberId, data);
    response.status(201).json({ status: 201, data: get("SELECT * FROM team_members WHERE id = ?", [memberId]) });
  });

  app.put("/api/admin/team/:id", adminOnly, (request, response) => {
    const data = parse(teamSchema, request.body, response);
    if (!data) return;
    const result = run(
      `UPDATE team_members SET name = ?, position = ?, bio = ?, profile = ?, github = ?, twitter = ?, linkedin = ?, sort_order = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [data.name, data.position, data.bio || null, data.profile, data.github || null, data.twitter || null, data.linkedin || null, data.sort_order, data.is_published ? 1 : 0, Number(request.params.id)]
    );
    if (!result.changes) return response.status(404).json({ status: "error", message: "Team member not found" });
    updateTeamContent(Number(request.params.id), data);
    response.json({ status: 200, data: get("SELECT * FROM team_members WHERE id = ?", [Number(request.params.id)]) });
  });

  app.delete("/api/admin/team/:id", adminOnly, (request, response) => {
    const result = run("DELETE FROM team_members WHERE id = ?", [Number(request.params.id)]);
    if (!result.changes) return response.status(404).json({ status: "error", message: "Team member not found" });
    response.status(204).end();
  });

  app.get("/api/admin/submissions", adminOnly, (_request, response) => response.json({ status: 200, data: all("SELECT * FROM submissions ORDER BY created_at DESC") }));

  app.patch("/api/admin/submissions/:id", adminOnly, (request, response) => {
    const allowed = new Set(["new", "contacted", "closed"]);
    if (!allowed.has(request.body.status)) return response.status(422).json({ status: "error", message: "Invalid status" });
    const result = run("UPDATE submissions SET status = ? WHERE id = ?", [request.body.status, Number(request.params.id)]);
    if (!result.changes) return response.status(404).json({ status: "error", message: "Submission not found" });
    response.json({ status: 200, data: get("SELECT * FROM submissions WHERE id = ?", [Number(request.params.id)]) });
  });

  app.use((error, _request, response, _next) => {
    const status = error instanceof multer.MulterError || error.message === "Unsupported image type" ? 400 : 500;
    if (status === 500) console.error(error);
    response.status(status).json({ status: "error", message: status === 500 ? "Internal server error" : error.message });
  });
  return app;
}
