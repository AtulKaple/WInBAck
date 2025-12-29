import fs from 'fs/promises';

// Stubbed secure write. In production, replace with encryption + key management.
export async function secureWrite(filePath: string, data: string): Promise<void> {
  await fs.mkdir(require('path').dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data, 'utf8');
}
