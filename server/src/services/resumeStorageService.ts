import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const storageRoot = path.resolve(process.cwd(), 'private-storage', 'resumes');
const avatarRoot = path.resolve(process.cwd(), 'private-storage', 'avatars');

export const resumeStorageService = {
  async save(buffer: Buffer, extension: string): Promise<string> {
    await fs.mkdir(storageRoot, { recursive: true });
    const key = `${crypto.randomUUID()}${extension}`;
    await fs.writeFile(path.join(storageRoot, key), buffer, { flag: 'wx' });
    return key;
  },
  async read(key: string): Promise<Buffer> {
    if (!/^[a-f0-9-]+\.(pdf|docx)$/i.test(key)) throw new Error('Invalid storage key');
    return fs.readFile(path.join(storageRoot, key));
  },
  async remove(key: string): Promise<void> {
    if (!/^[a-f0-9-]+\.(pdf|docx)$/i.test(key)) return;
    await fs.rm(path.join(storageRoot, key), { force: true });
  },
  async saveAvatar(buffer: Buffer, extension: string): Promise<string> {
    await fs.mkdir(avatarRoot, { recursive: true });
    const key = `${crypto.randomUUID()}${extension}`;
    await fs.writeFile(path.join(avatarRoot, key), buffer, { flag: 'wx' });
    return key;
  },
  async readAvatar(key: string): Promise<Buffer> {
    if (!/^[a-f0-9-]+\.(png|jpg|jpeg|webp)$/i.test(key)) throw new Error('Invalid avatar key');
    return fs.readFile(path.join(avatarRoot, key));
  },
  async removeAvatar(key: string): Promise<void> {
    if (!/^[a-f0-9-]+\.(png|jpg|jpeg|webp)$/i.test(key)) return;
    await fs.rm(path.join(avatarRoot, key), { force: true });
  }
};
