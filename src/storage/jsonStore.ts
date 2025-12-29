import fs from 'fs/promises';
import path from 'path';

export class JsonStore<T> {
  private queue: Promise<void> = Promise.resolve();

  constructor(private filePath: string, private defaultValue: T) {}

  private async ensureFile(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, JSON.stringify(this.defaultValue, null, 2), 'utf8');
    }
  }

  private withLock<R>(fn: () => Promise<R>): Promise<R> {
    const run = this.queue.then(async () => {
      await this.ensureFile();
      return fn();
    });

    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  async read(): Promise<T> {
    return this.withLock(async () => {
      const raw = await fs.readFile(this.filePath, 'utf8');
      if (!raw.trim()) {
        return this.defaultValue;
      }
      try {
        return JSON.parse(raw) as T;
      } catch {
        // If the file becomes corrupted, reset to default to keep the service functional.
        await fs.writeFile(this.filePath, JSON.stringify(this.defaultValue, null, 2), 'utf8');
        return this.defaultValue;
      }
    });
  }

  async write(value: T): Promise<T> {
    return this.withLock(async () => {
      await fs.writeFile(this.filePath, JSON.stringify(value, null, 2), 'utf8');
      return value;
    });
  }
}
