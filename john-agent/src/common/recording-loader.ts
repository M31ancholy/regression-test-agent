import { readFile, realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import type {
  OverallStepDesc,
  PreparedTestStep,
  RecordingDocument,
  RecordingViewport,
} from './types.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const stepSchema = z.object({
  desc: z.string().trim().min(1).max(2_000),
  screenshotPath: z.string().trim().min(1),
});

const viewportSchema = z.object({
  width: z.number().int().positive().max(7_680),
  height: z.number().int().positive().max(4_320),
});

const recordingDocumentSchema: z.ZodType<RecordingDocument> = z.object({
  version: z.literal(1),
  targetUrl: z.string().url(),
  viewport: viewportSchema,
  steps: z.array(stepSchema).min(1),
});

const legacyRecordingSchema = z.array(stepSchema).min(1);

export type PreparedRecording = {
  readyToTestURL: string;
  viewport?: RecordingViewport;
  steps: PreparedTestStep[];
};

export class RecordingValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RecordingValidationError';
  }
}

export function defaultRecordingsRoot(): string {
  return fileURLToPath(new URL('../../../util-record-steps/', import.meta.url));
}

export function configuredRecordingsRoot(): string {
  return resolve(process.env.RECORDINGS_ROOT ?? defaultRecordingsRoot());
}

export async function loadRecordingDirectory(options: {
  recordingPath: string;
  readyToTestURL?: string;
  recordingsRoot?: string;
}): Promise<PreparedRecording> {
  const root = await resolveRoot(options.recordingsRoot);
  const recordingDirectory = await resolveWithinRoot(root, options.recordingPath, '录制目录');

  if (!(await stat(recordingDirectory)).isDirectory()) {
    throw new RecordingValidationError('录制路径不是目录');
  }

  let json: unknown;
  try {
    const stepsFile = await resolveWithinRoot(
      recordingDirectory,
      'steps.json',
      'steps.json',
      recordingDirectory,
    );
    json = JSON.parse(await readFile(stepsFile, 'utf8'));
  } catch (error) {
    throw new RecordingValidationError('无法读取或解析录制目录中的 steps.json', { cause: error });
  }

  const documentResult = recordingDocumentSchema.safeParse(json);
  if (documentResult.success) {
    return {
      readyToTestURL: documentResult.data.targetUrl,
      viewport: documentResult.data.viewport,
      steps: await prepareSteps(documentResult.data.steps, recordingDirectory, recordingDirectory),
    };
  }

  const legacyResult = legacyRecordingSchema.safeParse(json);
  if (!legacyResult.success) {
    throw new RecordingValidationError('steps.json 不符合录制文档 version=1 或旧版步骤数组格式');
  }
  if (!options.readyToTestURL) {
    throw new RecordingValidationError('旧版录制不包含 targetUrl，请传入 readyToTestURL');
  }

  return {
    readyToTestURL: parseUrl(options.readyToTestURL),
    steps: await prepareSteps(legacyResult.data, recordingDirectory, recordingDirectory),
  };
}

export async function prepareInlineSteps(options: {
  steps: OverallStepDesc;
  readyToTestURL: string;
  recordingsRoot?: string;
}): Promise<PreparedRecording> {
  const parsedSteps = legacyRecordingSchema.safeParse(options.steps);
  if (!parsedSteps.success) {
    throw new RecordingValidationError('内联 steps 必须是非空的有效步骤数组');
  }

  const root = await resolveRoot(options.recordingsRoot);
  return {
    readyToTestURL: parseUrl(options.readyToTestURL),
    steps: await prepareSteps(parsedSteps.data, root, root),
  };
}

async function resolveRoot(configuredRoot?: string): Promise<string> {
  try {
    const root = await realpath(resolve(configuredRoot ?? configuredRecordingsRoot()));
    if (!(await stat(root)).isDirectory()) throw new Error('not a directory');
    return root;
  } catch (error) {
    throw new RecordingValidationError('录制根目录不存在或不可读', { cause: error });
  }
}

async function prepareSteps(
  steps: OverallStepDesc,
  baseDirectory: string,
  allowedDirectory: string,
): Promise<PreparedTestStep[]> {
  return Promise.all(steps.map(async step => {
    const screenshotPath = await resolveWithinRoot(allowedDirectory, step.screenshotPath, '参考截图', baseDirectory);
    const screenshotStat = await stat(screenshotPath);
    if (!screenshotStat.isFile()) {
      throw new RecordingValidationError(`参考截图不是文件: ${step.screenshotPath}`);
    }

    let referenceScreenshotData: Buffer;
    try {
      referenceScreenshotData = await readFile(screenshotPath);
    } catch (error) {
      throw new RecordingValidationError(`参考截图不可读: ${step.screenshotPath}`, { cause: error });
    }
    if (!referenceScreenshotData.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      throw new RecordingValidationError(`参考截图不是有效的 PNG: ${step.screenshotPath}`);
    }

    return {
      desc: step.desc,
      screenshotPath: step.screenshotPath,
      referenceScreenshotData,
    };
  }));
}

async function resolveWithinRoot(
  root: string,
  requestedPath: string,
  label: string,
  baseDirectory = root,
): Promise<string> {
  if (!requestedPath || isAbsolute(requestedPath)) {
    throw new RecordingValidationError(`${label}必须是录制根目录下的相对路径`);
  }

  try {
    const resolvedPath = await realpath(resolve(baseDirectory, requestedPath));
    if (!isPathInside(root, resolvedPath)) {
      throw new RecordingValidationError(`${label}超出允许的录制目录`);
    }
    return resolvedPath;
  } catch (error) {
    if (error instanceof RecordingValidationError) throw error;
    throw new RecordingValidationError(`${label}不存在或不可读: ${requestedPath}`, { cause: error });
  }
}

function isPathInside(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === '' || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..' && !isAbsolute(pathFromRoot));
}

function parseUrl(value: string): string {
  try {
    return new URL(value).toString();
  } catch (error) {
    throw new RecordingValidationError('readyToTestURL 不是有效 URL', { cause: error });
  }
}
