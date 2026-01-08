import fs from "fs";
import path from "path";

const basePath = path.resolve("src/modules/consents/data");

const safeRead = (file: string) => {
  const full = path.join(basePath, file);
  if (!fs.existsSync(full)) return {};
  const raw = fs.readFileSync(full, "utf-8").trim();
  return raw ? JSON.parse(raw) : {};
};

const safeWrite = (file: string, data: any) => {
  const full = path.join(basePath, file);
  fs.writeFileSync(full, JSON.stringify(data, null, 2));
};

export const StorageAdapter = {
  readConsents: () => safeRead("consents.json"),
  writeConsents: (d: any) => safeWrite("consents.json", d),

  readAudit: () => safeRead("auditChain.json"),
  writeAudit: (d: any) => safeWrite("auditChain.json", d)
};
