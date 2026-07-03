import * as vscode from 'vscode';

// Temporary instrumentation for tracking down the collapse flicker. Remove once fixed.
let channel: vscode.OutputChannel | undefined;

let start = Date.now();
export function resetClock(): void {
  start = Date.now();
}

export function log(msg: string): void {
  if (!vscode.window?.createOutputChannel) return; // no-op under the jest vscode mock
  if (!channel) {
    channel = vscode.window.createOutputChannel('Sparse Explorer Debug');
  }
  channel.appendLine(`[+${Date.now() - start}ms] ${msg}`);
}
