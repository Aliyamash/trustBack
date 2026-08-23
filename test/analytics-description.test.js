import test from "node:test";
import assert from "node:assert/strict";
import { describeVisit } from "../src/analytics.js";

function requestFor({ ip, userAgent, country }) {
  return {
    ip,
    socket: { remoteAddress: ip },
    get(name) {
      const headers = { "user-agent": userAgent, "cf-ipcountry": country };
      return headers[name.toLowerCase()] || "";
    },
  };
}

test("describes device and country without retaining the IP address", () => {
  const result = describeVisit(requestFor({
    ip: "8.8.8.8",
    country: "DE",
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36",
  }), true);
  assert.equal(result.countryCode, "DE");
  assert.equal(result.deviceType, "mobile");
  assert.match(result.deviceName, /Pixel 8 Pro/);
  assert.equal(Object.hasOwn(result, "ip"), false);
});
