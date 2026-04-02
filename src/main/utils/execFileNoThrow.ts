import { execFile } from 'child_process'

export interface ExecFileNoThrowResult {
  status: number
  stdout: string
  stderr: string
}

export async function execFileNoThrow(
  command: string,
  args: string[]
): Promise<ExecFileNoThrowResult> {
  return new Promise((resolve) => {
    execFile(command, args, (error, stdout, stderr) => {
      resolve({
        status: error ? 1 : 0,
        stdout: stdout || '',
        stderr: stderr || ''
      })
    })
  })
}
