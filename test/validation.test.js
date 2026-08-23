import test from "node:test";
import assert from "node:assert/strict";
import { analyticsVisitSchema, normalizeSubmission, submissionSchema } from "../src/validation.js";

test("normalizes the legacy frontend field names", () => {
  const value = normalizeSubmission({ Full_Name: "Jane Doe", Email: "jane@example.com", Inquiry: "A project", Agree_terms: "on", form_page: "get_in_touch" });
  assert.equal(value.full_name, "Jane Doe");
  assert.equal(value.consent, true);
});

test("rejects invalid email", () => {
  const result = submissionSchema.safeParse({ form_page: "footer", email: "invalid", consent: false });
  assert.equal(result.success, false);
});

test("requires service-specific fields", () => {
  const result = submissionSchema.safeParse({ form_page: "service", full_name: "Jane", email: "jane@example.com", inquiry: "Website", consent: false });
  assert.equal(result.success, false);
});

test("accepts an anonymous analytics visit and rejects external paths", () => {
  const valid = analyticsVisitSchema.safeParse({
    session_id: "fdf0249a-a35b-4e32-b14d-bb689c661af5",
    path: "/projects?category=web",
    referrer: "https://example.com/",
  });
  const invalid = analyticsVisitSchema.safeParse({
    session_id: "fdf0249a-a35b-4e32-b14d-bb689c661af5",
    path: "https://malicious.example/",
  });
  assert.equal(valid.success, true);
  assert.equal(invalid.success, false);
});
