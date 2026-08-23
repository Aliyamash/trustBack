import net from "node:net";
import geoip from "geoip-lite";
import UAParser from "ua-parser-js";

function cleanIp(value = "") {
  const first = String(value).split(",")[0].trim().replace(/^\[|\]$/g, "");
  return first.startsWith("::ffff:") ? first.slice(7) : first;
}

function headerCountry(request, trustProxy) {
  if (!trustProxy) return "";
  const value = request.get("cf-ipcountry") || request.get("x-vercel-ip-country") || "";
  return /^[A-Z]{2}$/i.test(value) && !["XX", "T1"].includes(value.toUpperCase()) ? value.toUpperCase() : "";
}

export function describeVisit(request, trustProxy = false) {
  const userAgent = (request.get("user-agent") || "").slice(0, 1000);
  const parsed = new UAParser(userAgent).getResult();
  const ip = cleanIp(request.ip || request.socket?.remoteAddress);
  const location = net.isIP(ip) ? geoip.lookup(ip) : null;
  const countryCode = headerCountry(request, trustProxy) || location?.country || "ZZ";
  const deviceType = parsed.device.type || "desktop";
  const deviceName = [parsed.device.vendor, parsed.device.model].filter(Boolean).join(" ") || (deviceType === "desktop" ? "Desktop" : "Unknown");
  const browser = [parsed.browser.name, parsed.browser.major].filter(Boolean).join(" ") || "Unknown";
  const operatingSystem = [parsed.os.name, parsed.os.version].filter(Boolean).join(" ") || "Unknown";

  return {
    countryCode,
    deviceType,
    deviceName,
    browser,
    operatingSystem,
  };
}
