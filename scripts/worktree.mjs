#!/usr/bin/env node

import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [, , action, scope, branchArg] = process.argv;

function printUsage() {
  console.error(
    [
      'Usage:',
      '  pnpm worktree:add <branch>',
      '  pnpm worktree:add:internal <branch>',
      '  pnpm worktree:remove <branch>',
      '  pnpm worktree:remove:internal <branch>',
      '  pnpm worktree:list',
    ].join('\n')
  );
}

function runGit(args) {
  const result = spawnSync('git', args, { stdio: 'inherit' });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function branchExists(branch) {
  const result = spawnSync(
    'git',
    ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`],
    { stdio: 'ignore' }
  );

  return result.status === 0;
}

function resolveTargetPath(branch, targetScope) {
  const safeBranchName = branch.replace(/[\\/]/g, '-');

  if (targetScope === 'internal') {
    return path.join('worktrees', safeBranchName);
  }

  return path.join('..', `drop-ai--${safeBranchName}`);
}

if (
  !['add', 'remove'].includes(action) ||
  !['external', 'internal'].includes(scope)
) {
  printUsage();
  process.exit(1);
}

if (!branchArg) {
  printUsage();
  process.exit(1);
}

const targetPath = resolveTargetPath(branchArg, scope);

if (action === 'add') {
  if (branchExists(branchArg)) {
    runGit(['worktree', 'add', targetPath, branchArg]);
  } else {
    runGit(['worktree', 'add', '-b', branchArg, targetPath]);
  }
} else {
  runGit(['worktree', 'remove', targetPath]);
}
