import { environment } from "@raycast/api";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_OUTPUT_DIR, getRuntimeReport } from "./runtime";
import { createTaskState, writeTaskState, type TaskRecord, type TaskState } from "./task-store";

export type DownloadMode = "video" | "mp4" | "audio";
export type CookieSource = "none" | "chrome" | "safari" | "firefox";

export interface DownloadJob {
  mode: DownloadMode;
  outputDir: string;
  subtitles: boolean;
  cookies: CookieSource;
  ytDlpPath?: string;
  ffmpegPath?: string;
}

export function enqueueTask(
  job: DownloadJob,
  url: string,
  options: { attempt?: number; retryOf?: string } = {},
): TaskRecord {
  const workerPath = join(environment.assetsPath, "worker.js");
  const outputDir = job.outputDir || DEFAULT_OUTPUT_DIR;
  const runtime = job.ytDlpPath && job.ffmpegPath ? null : getRuntimeReport(outputDir);
  const task = createTaskState({
    url,
    mode: job.mode,
    outputDir,
    subtitles: job.subtitles,
    cookies: job.cookies,
    ytDlpPath: job.ytDlpPath ?? runtime?.ytDlp.path ?? undefined,
    ffmpegPath: job.ffmpegPath ?? runtime?.ffmpeg.path ?? undefined,
    attempt: options.attempt ?? 1,
    retryOf: options.retryOf,
  });
  const { statePath: _statePath, ...baseState } = task;

  if (!existsSync(workerPath)) {
    const timestamp = new Date().toISOString();
    const failedState: TaskState = {
      ...baseState,
      status: "failure",
      phase: "finished",
      pid: null,
      error: "后台 worker 文件不存在",
      errorKind: "environment",
      errorHint: "请重新安装或重新加载 Raycast 扩展，然后再试。",
      finishedAt: timestamp,
      updatedAt: timestamp,
    };
    writeTaskSafely(task.statePath, failedState);
    return task;
  }

  const failToStart = (message: string) => {
    const timestamp = new Date().toISOString();
    writeTaskSafely(task.statePath, {
      ...baseState,
      status: "failure",
      phase: "finished",
      pid: null,
      error: "后台 worker 启动失败",
      errorKind: "environment",
      errorHint: message,
      finishedAt: timestamp,
      updatedAt: timestamp,
    });
  };

  try {
    const child = spawn(process.execPath, [workerPath, task.statePath], {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        PATH: [
          task.ytDlpPath ? join(task.ytDlpPath, "..") : undefined,
          task.ffmpegPath ? join(task.ffmpegPath, "..") : undefined,
          process.env.PATH ?? "/usr/bin:/bin",
        ]
          .filter(Boolean)
          .join(":"),
      },
    });
    child.once("error", (error) => failToStart(error.message));
    child.unref();
  } catch (error) {
    failToStart(error instanceof Error ? error.message : String(error));
  }

  return task;
}

export function retryTask(task: TaskRecord): TaskRecord {
  return enqueueTask(
    {
      mode: task.mode,
      outputDir: task.outputDir,
      subtitles: task.subtitles,
      cookies: task.cookies,
    },
    task.url,
    {
      attempt: (task.attempt ?? 1) + 1,
      retryOf: task.id,
    },
  );
}

function writeTaskSafely(statePath: string, state: TaskState): void {
  try {
    writeTaskState(statePath, state);
  } catch {
    // The worker will surface an unreadable/unchanged state as interrupted after its startup timeout.
  }
}
