import { execFileSync } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, statSync, statfsSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_OUTPUT_DIR = join(homedir(), "Downloads", "Media Saver");
export const DEFAULT_OUTPUT_DISPLAY = "~/Downloads/Media Saver";
export const INSTALL_COMMAND = "brew install yt-dlp ffmpeg";
export const TERMINAL_APP_PATHS = [
  "/System/Applications/Utilities/Terminal.app",
  "/Applications/Utilities/Terminal.app",
];

const MIN_FREE_BYTES = 50 * 1024 * 1024;

export interface BinaryStatus {
  name: "yt-dlp" | "ffmpeg" | "Homebrew";
  path: string | null;
  version: string | null;
  error?: string;
}

export interface OutputDirectoryStatus {
  path: string;
  writable: boolean;
  freeBytes: number | null;
  error?: string;
}

export interface RuntimeReport {
  platform: string;
  architecture: string;
  ytDlp: BinaryStatus;
  ffmpeg: BinaryStatus;
  homebrew: BinaryStatus;
  outputDirectory: OutputDirectoryStatus;
  ready: boolean;
  installCommand: string;
}

function pathDirectories(): string[] {
  const pathValue = process.env.PATH ?? "";
  return [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    ...pathValue.split(":").filter(Boolean),
  ].filter((directory, index, directories) => directories.indexOf(directory) === index);
}

export function findExecutable(name: string): string | null {
  for (const directory of pathDirectories()) {
    const candidate = join(directory, name);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next known Homebrew/PATH location.
    }
  }
  return null;
}

function readVersion(path: string, args: string[]): { version: string | null; error?: string } {
  try {
    const output = execFileSync(path, args, {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const version = output
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return { version: version ?? null };
  } catch (error) {
    return { version: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function inspectBinary(
  name: BinaryStatus["name"],
  versionArgs: string[],
): BinaryStatus {
  const path = findExecutable(name === "Homebrew" ? "brew" : name);
  if (!path) return { name, path: null, version: null, error: `${name} 未找到` };
  const result = readVersion(path, versionArgs);
  return { name, path, version: result.version, error: result.error };
}

function inspectOutputDirectory(outputDir: string): OutputDirectoryStatus {
  try {
    mkdirSync(outputDir, { recursive: true });
    if (!statSync(outputDir).isDirectory()) {
      return { path: outputDir, writable: false, freeBytes: null, error: "路径不是文件夹" };
    }

    const probePath = join(outputDir, `.yt-dlp-raycast-write-test-${process.pid}`);
    writeFileSync(probePath, "ok", "utf8");
    unlinkSync(probePath);

    let freeBytes: number | null = null;
    if (typeof statfsSync === "function") {
      const stats = statfsSync(outputDir);
      freeBytes = Number(stats.bavail) * Number(stats.bsize);
    }

    return {
      path: outputDir,
      writable: true,
      freeBytes,
      ...(freeBytes !== null && freeBytes < MIN_FREE_BYTES ? { error: "可用空间低于 50 MB" } : {}),
    };
  } catch (error) {
    return {
      path: outputDir,
      writable: false,
      freeBytes: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getRuntimeReport(outputDir = DEFAULT_OUTPUT_DIR): RuntimeReport {
  const homebrew = inspectBinary("Homebrew", ["--version"]);
  const ytDlp = inspectBinary("yt-dlp", ["--version"]);
  const ffmpeg = inspectBinary("ffmpeg", ["-version"]);
  const outputDirectory = inspectOutputDirectory(outputDir);
  const ready = Boolean(
    ytDlp.path &&
      ytDlp.version &&
      ffmpeg.path &&
      ffmpeg.version &&
      outputDirectory.writable &&
      !outputDirectory.error,
  );

  return {
    platform: process.platform,
    architecture: process.arch,
    ytDlp,
    ffmpeg,
    homebrew,
    outputDirectory,
    ready,
    installCommand: INSTALL_COMMAND,
  };
}

export function getTerminalAppPath(): string {
  return TERMINAL_APP_PATHS.find((path) => existsSync(path)) ?? TERMINAL_APP_PATHS[0];
}
