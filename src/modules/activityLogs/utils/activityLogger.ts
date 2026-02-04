import { getCognitoUserEmail } from "../../../aws/cognitoUser.service";
import { ActivityLogModel } from "../models/ActivityLog";
import geoip from "geoip-lite";

type LogInput = {
  req?: any;
  actorUserId?: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "OTHER" | "LOGIN" | "LOGOUT";
  resource: string;
  resourceId?: string;
  description: string;
  targetName?: string;
  changes?: any;
  success?: boolean;
  errorMessage?: string;
};

// Country code to name mapping for common countries
const countryNames = {
  US: "United States",
  IN: "India",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  JP: "Japan",
  CN: "China",
  BR: "Brazil",
  RU: "Russia",
  IT: "Italy",
  ES: "Spain",
  MX: "Mexico",
  KR: "South Korea",
  NL: "Netherlands",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  SG: "Singapore",
  AE: "UAE",
  SA: "Saudi Arabia",
  PK: "Pakistan",
  BD: "Bangladesh",
  ID: "Indonesia",
  PH: "Philippines",
  MY: "Malaysia",
  TH: "Thailand",
  VN: "Vietnam",
  ZA: "South Africa",
  NG: "Nigeria",
  EG: "Egypt",
  KE: "Kenya",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  PL: "Poland",
  UA: "Ukraine",
  CZ: "Czech Republic",
  AT: "Austria",
  CH: "Switzerland",
  BE: "Belgium",
  PT: "Portugal",
  GR: "Greece",
  IE: "Ireland",
  NZ: "New Zealand",
  IL: "Israel",
  TR: "Turkey",
  HK: "Hong Kong",
  TW: "Taiwan",
};

function getClientIp(req) {
  if (!req || !req.headers) return "unknown";
  // Try multiple headers for real IP (important for proxied requests)
  const headers = [
    "x-real-ip",
    "x-forwarded-for",
    "cf-connecting-ip", // Cloudflare
    "x-client-ip",
    "x-cluster-client-ip",
    "forwarded-for",
    "forwarded",
    "true-client-ip", // Akamai
  ];

  for (const header of headers) {
    const value = req.headers[header];
    if (typeof value === "string" && value.length > 0) {
      // x-forwarded-for can have multiple IPs, take the first one
      const ip = value.split(",")[0].trim();
      // Skip localhost/private IPs if we can get a better one
      if (ip && !isPrivateIp(ip)) {
        return ip;
      }
    }
  }

  // Fallback to connection IP
  const connectionIp = req.ip || req.connection?.remoteAddress || "";

  // ::1 means localhost in IPv6
  if (connectionIp === "::1" || connectionIp === "127.0.0.1") {
    return "localhost";
  }

  // ::ffff:127.0.0.1 is IPv4-mapped IPv6 for localhost
  if (connectionIp.startsWith("::ffff:")) {
    const ipv4 = connectionIp.slice(7);
    if (ipv4 === "127.0.0.1") return "localhost";
    return ipv4;
  }

  return connectionIp;
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === "localhost" || ip === "::1" || ip === "127.0.0.1") return true;

  // Check for private IPv4 ranges
  const parts = ip.split(".").map(Number);
  if (parts.length === 4) {
    // 10.x.x.x
    if (parts[0] === 10) return true;
    // 172.16.x.x - 172.31.x.x
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.x.x
    if (parts[0] === 192 && parts[1] === 168) return true;
  }

  return false;
}

function parseUserAgent(ua) {
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "Unknown" };

  let browser = "Unknown";
  let os = "Unknown";
  let device = "Desktop";

  // Browser detection
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Opera") || ua.includes("OPR/")) browser = "Opera";

  // OS detection
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  // Device detection
  if (ua.includes("Mobile") || ua.includes("Android")) device = "Mobile";
  else if (ua.includes("iPad") || ua.includes("Tablet")) device = "Tablet";

  return { browser, os, device };
}

function safeBodyKeys(req) {
  const body = req.body;
  if (!body || typeof body !== "object") return [];
  if (Array.isArray(body)) return ["<array>"];
  return Object.keys(body).slice(0, 50);
}

export async function logActivity({
  req,
  actorUserId,
  action,
  resource,
  resourceId,
  description,
  targetName,
  changes,
  success = true,
  errorMessage,
}: LogInput) {
  const safeReq = req ?? null;

  const ip = safeReq ? getClientIp(safeReq) : "system";
  const geo =
    safeReq && ip !== "localhost" ? geoip.lookup(ip) : null;

  const userAgentStr =
    safeReq?.headers?.["user-agent"] ?? "system";

  const { browser, os, device } =
    safeReq ? parseUserAgent(userAgentStr) : {
      browser: "System",
      os: "Server",
      device: "Cron",
    };

  try {
    await ActivityLogModel.create({
      actorUserId,
      // ✅ SAFE ACTOR
      actor: safeReq?.authContext
        ? {
            id: safeReq.authContext.userId,
            role: safeReq.authContext.role,
          }
        : actorUserId === "SYSTEM"
          ? { id: "SYSTEM", role: "SYSTEM" }
          : undefined,

      action,
      method: safeReq?.method,
      path: safeReq?.originalUrl,

      resource,
      resourceId,
      description,
      targetName,
      changes,

      success,
      statusCode: success ? 200 : 500,
      errorMessage,

      ip: ip || "unknown",
      realIp:
        safeReq?.headers?.["x-real-ip"] ||
        safeReq?.headers?.["x-forwarded-for"]?.split(",")[0] ||
        ip,
      geo: geo
        ? {
            country: geo.country,
            countryName: countryNames[geo.country] || geo.country,
            region: geo.region,
            regionName: geo.region, // geoip-lite doesn't have region names
            city: geo.city,
            ll: geo.ll,
            timezone: geo.timezone,
          }
        : ip === "localhost"
          ? { country: "LOCAL", countryName: "Localhost", city: "Development" }
          : undefined,
      userAgent: userAgentStr,
      browser,
      os,
      device,
       params: safeReq?.params,
      query: safeReq?.query,
      bodyKeys: safeReq ? safeBodyKeys(safeReq) : [],
    });
  } catch (err) {
    console.error("❌ Activity log failed:", err);
  }
}
