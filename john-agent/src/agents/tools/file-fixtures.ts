import { readFile, realpath, stat } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { z } from 'zod';

const MAX_FIXTURE_SIZE_BYTES = 10 * 1024 * 1024;

export const fixtureFilenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[^/\\]+$/, '文件名不能包含路径分隔符');

export type ResolvedFixtureFile = {
  name: string;
  path: string;
  data: Buffer;
};

export async function resolveFixtureFiles(filenames: string[]): Promise<ResolvedFixtureFile[]> {
  const configuredRoot = process.env.FILE_FIXTURES_ROOT;
  if (!configuredRoot) {
    throw new Error('未配置 FILE_FIXTURES_ROOT，无法回放文件操作');
  }

  const root = await realpath(resolve(configuredRoot));
  if (!(await stat(root)).isDirectory()) throw new Error('FILE_FIXTURES_ROOT 不是可读目录');

  return Promise.all(filenames.map(async requestedName => {
    const name = requestedName.trim();
    if (isAbsolute(name) || basename(name) !== name) {
      throw new Error(`非法的测试文件名: ${requestedName}`);
    }
    const path = await realpath(resolve(root, name));
    const pathFromRoot = relative(root, path);
    if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
      throw new Error(`测试文件超出 FILE_FIXTURES_ROOT: ${name}`);
    }
    const fileStat = await stat(path);
    if (!fileStat.isFile()) throw new Error(`测试文件不是普通文件: ${name}`);
    if (fileStat.size > MAX_FIXTURE_SIZE_BYTES) {
      throw new Error(`测试文件超过 10MB 限制: ${name}`);
    }
    return { name, path, data: await readFile(path) };
  }));
}
