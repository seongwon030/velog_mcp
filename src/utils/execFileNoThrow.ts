import { execFile } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function execFileNoThrow(
  file: string,
  args: string[],
): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(file, args, { encoding: "utf8" }, (err, stdout, stderr) => {
      if (!err) {
        resolve({ stdout, stderr, exitCode: 0 });
        return;
      }
      const exitCode = typeof err.code === "number" ? err.code : 1;
      resolve({
        stdout: stdout ?? "",
        stderr: stderr || err.message,
        exitCode,
      });
    });
  });
}
