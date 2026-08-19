import { createWorker, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  workerPromise ??= createWorker('eng');
  return workerPromise;
}

export async function recognize(png: Buffer): Promise<string> {
  const worker = await getWorker();
  const result = await worker.recognize(png);
  return result.data.text.trim();
}

export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
}
