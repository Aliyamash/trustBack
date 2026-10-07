import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "trustence-analytics-test-"));
process.env.DATABASE_PATH = path.join(fixtureDir, "test.sqlite");
process.env.UPLOAD_DIR = path.join(fixtureDir, "uploads");
process.env.ADMIN_API_KEY = "integration-test-key";
process.env.TRUST_PROXY = "1";

const { createApp } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const server = createApp().listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.close();
  fs.rmSync(fixtureDir, { recursive: true, force: true });
});

test("records a page view and exposes aggregated admin analytics", async () => {
  const visit = await fetch(`${baseUrl}/api/analytics/visit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "8.8.8.8",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    },
    body: JSON.stringify({
      session_id: "fdf0249a-a35b-4e32-b14d-bb689c661af5",
      path: "/projects",
      referrer: "https://example.com/",
    }),
  });
  assert.equal(visit.status, 204);

  const stats = await fetch(`${baseUrl}/api/admin/stats`, {
    headers: { "x-admin-api-key": "integration-test-key" },
  });
  assert.equal(stats.status, 200);
  const payload = await stats.json();
  assert.equal(payload.data.summary.pageViews, 1);
  assert.equal(payload.data.summary.uniqueSessions, 1);
  assert.equal(payload.data.summary.teamMembers, 7);
  assert.equal(payload.data.summary.projects, 2);
  assert.equal(payload.data.topPages[0].path, "/projects");
  assert.equal(payload.data.topPages[0].views, 1);
  assert.equal(payload.data.countries[0].label, "US");
  assert.equal(payload.data.devices[0].label, "mobile");
  assert.match(payload.data.recentVisits[0].device_name, /iPhone/);
});

test("adds, returns, and removes a project gallery image", async () => {
  const headers = { "Content-Type": "application/json", "x-admin-api-key": "integration-test-key" };
  const projectsResponse = await fetch(`${baseUrl}/api/admin/projects`, { headers });
  const projects = (await projectsResponse.json()).data;
  const project = projects[0];

  const created = await fetch(`${baseUrl}/api/admin/projects/${project.id}/images`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path: "/uploads/case-study.webp", alt_text: "Case study screen", alt_text_en: "Case study screen", alt_text_fa: "نمای پروژه", sort_order: 0 }),
  });
  assert.equal(created.status, 201);
  const image = (await created.json()).data;

  const publicProject = await fetch(`${baseUrl}/api/projects/${project.id}`);
  assert.equal(publicProject.status, 200);
  assert.deepEqual((await publicProject.json()).data.gallery, [{ id: image.id, path: "/uploads/case-study.webp", alt_text: "Case study screen", alt_text_en: "Case study screen", alt_text_fa: "نمای پروژه", sort_order: 0 }]);

  const updated = await fetch(`${baseUrl}/api/admin/projects/${project.id}/images/${image.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ alt_text: "Updated screen", alt_text_en: "Updated screen", alt_text_fa: "نمای به‌روزشده", sort_order: 1 }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).data.alt_text_fa, "نمای به‌روزشده");

  const deleted = await fetch(`${baseUrl}/api/admin/projects/${project.id}/images/${image.id}`, { method: "DELETE", headers });
  assert.equal(deleted.status, 204);
});

test("persists bilingual project case-study fields when editing", async () => {
  const headers = { "Content-Type": "application/json", "x-admin-api-key": "integration-test-key" };
  const projects = (await (await fetch(`${baseUrl}/api/admin/projects`, { headers })).json()).data;
  const project = projects[0];
  const updatedLink = "https://example.com/case-study";

  const updated = await fetch(`${baseUrl}/api/admin/projects/${project.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      title: project.title,
      title_en: project.title,
      title_fa: "پروژه آزمایشی",
      category_name: project.category_name,
      intro: project.intro,
      description: project.description || "Case study",
      link: updatedLink,
      banner: project.banner,
      tags: project.tags || "Design",
      challenge_en: "A verified operational challenge.",
      challenge_fa: "یک چالش عملیاتی تأییدشده.",
      results_en: "35% | Faster processing",
      results_fa: "۳۵٪ | پردازش سریع‌تر",
      is_published: true,
    }),
  });
  assert.equal(updated.status, 200);

  const publicProject = await fetch(`${baseUrl}/api/projects/${project.id}`);
  const payload = (await publicProject.json()).data;
  assert.equal(payload.link, updatedLink);
  assert.equal(payload.title_fa, "پروژه آزمایشی");
  assert.equal(payload.challenge_en, "A verified operational challenge.");
  assert.equal(payload.results_fa, "۳۵٪ | پردازش سریع‌تر");
});
