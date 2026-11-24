#!/usr/bin/env node
/**
 * research paradigm · by WTD — workspace bootstrapper.
 *
 * Copies the kit/ tree into a research workspace, installs the rp-* skills into
 * a workspace skill root, and seeds .research/config.yml.
 *
 * Zero dependencies. Never overwrites an existing file.
 *
 *   node init.mjs [--dir <path>] [--skills-scope project|user] [--merge-agents]
 *                 [--no-skills] [--dry-run] [--help]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'kit');
const SELF_DIR = path.dirname(fileURLToPath(import.meta.url));
const MARKER_START = '<!-- rp-kit:start -->';
const MARKER_END = '<!-- rp-kit:end -->';

function usage() {
  console.log(`research paradigm · by WTD — init

用法:
  node init.mjs [选项]

选项:
  --dir <path>               目标工作区，默认当前目录
  --skills-scope project     技能装到 <工作区>/.agents/skills（默认）
  --skills-scope user        技能装到 ~/.agents/skills（跨项目共享）
  --merge-agents             工作区已有 AGENTS.md 时，把 rp-kit 段追加进去
  --no-skills                只建目录与规则，不装技能
  --no-scripts               不把 init.mjs / check.mjs 复制进工作区
  --dry-run                  只打印计划，不写盘
  --help                     显示本说明

幂等：已存在的文件一律跳过，永不覆盖。
`);
}

function parseArgs(argv) {
  const opts = { dir: process.cwd(), skillsScope: 'project', mergeAgents: false, noSkills: false, noScripts: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dir') opts.dir = argv[(i += 1)];
    else if (a === '--skills-scope') opts.skillsScope = argv[(i += 1)];
    else if (a === '--merge-agents') opts.mergeAgents = true;
    else if (a === '--no-skills') opts.noSkills = true;
    else if (a === '--no-scripts') opts.noScripts = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`未知参数: ${a}`);
  }
  if (!['project', 'user'].includes(opts.skillsScope)) throw new Error('--skills-scope 只能是 project 或 user');
  return opts;
}

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push({ full, rel: path.relative(base, full) });
  }
  return out;
}

function writeFile(dest, content, opts, actions) {
  if (fs.existsSync(dest)) {
    actions.push({ dest, action: 'skip', note: '已存在' });
    return;
  }
  if (!opts.dryRun) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, 'utf8');
  }
  actions.push({ dest, action: opts.dryRun ? 'would-create' : 'create', note: '' });
}

function copyFile(src, dest, opts, actions) {
  if (fs.existsSync(dest)) {
    actions.push({ dest, action: 'skip', note: '已存在' });
    return;
  }
  if (!opts.dryRun) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  actions.push({ dest, action: opts.dryRun ? 'would-create' : 'create', note: '' });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }
  const target = path.resolve(opts.dir);
  const actions = [];

  if (!fs.existsSync(KIT_ROOT)) throw new Error(`找不到 kit 目录: ${KIT_ROOT}`);
  if (!opts.dryRun) fs.mkdirSync(target, { recursive: true });

  const skillsRoot =
    opts.skillsScope === 'user'
      ? path.join(os.homedir(), '.agents', 'skills')
      : path.join(target, '.agents', 'skills');

  for (const { full, rel } of walk(KIT_ROOT)) {
    if (rel.startsWith('skills' + path.sep)) continue; // skills handled below
    if (rel === path.join('.research', 'config.example.yml')) continue; // seeded below
    const dest = path.join(target, rel);

    if (rel === 'AGENTS.md' && fs.existsSync(dest)) {
      const current = fs.readFileSync(dest, 'utf8');
      if (current.includes(MARKER_START)) {
        actions.push({ dest, action: 'skip', note: '已含 rp-kit 段' });
      } else if (opts.mergeAgents) {
        const snippet = fs.readFileSync(full, 'utf8');
        if (!opts.dryRun) fs.appendFileSync(dest, `\n\n${snippet}\n`, 'utf8');
        actions.push({ dest, action: opts.dryRun ? 'would-append' : 'append', note: '已追加 rp-kit 段' });
      } else {
        writeFile(path.join(target, 'AGENTS.rp-kit.md'), fs.readFileSync(full, 'utf8'), opts, actions);
        actions.push({ dest, action: 'skip', note: '已有 AGENTS.md，改为生成 AGENTS.rp-kit.md 待手工并入（或加 --merge-agents）' });
      }
      continue;
    }
    copyFile(full, dest, opts, actions);
  }

  // .research/config.yml: seed from the example so TODO placeholders stay visible.
  const example = path.join(KIT_ROOT, '.research', 'config.example.yml');
  if (fs.existsSync(example)) {
    writeFile(path.join(target, '.research', 'config.yml'), fs.readFileSync(example, 'utf8'), opts, actions);
  }

  // Self-contained workspace: ship the two zero-dependency scripts alongside the rules.
  if (!opts.noScripts) {
    for (const name of ['init.mjs', 'check.mjs']) {
      const src = path.join(SELF_DIR, name);
      if (fs.existsSync(src)) copyFile(src, path.join(target, name), opts, actions);
    }
  }

  if (!opts.noSkills) {
    const skillSrc = path.join(KIT_ROOT, 'skills');
    if (fs.existsSync(skillSrc)) {
      for (const entry of fs.readdirSync(skillSrc, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        for (const { full, rel } of walk(path.join(skillSrc, entry.name))) {
          copyFile(full, path.join(skillsRoot, entry.name, rel), opts, actions);
        }
      }
    }
  }

  const created = actions.filter((a) => a.action !== 'skip');
  console.log(`\nresearch paradigm · by WTD — init ${opts.dryRun ? '(dry-run)' : ''}`);
  console.log(`目标工作区: ${target}`);
  console.log(`技能根    : ${opts.noSkills ? '(跳过)' : skillsRoot}\n`);
  for (const a of actions) {
    const rel = path.relative(target, a.dest) || a.dest;
    const tag = a.action.padEnd(12);
    console.log(`  ${tag} ${rel}${a.note ? '  // ' + a.note : ''}`);
  }
  console.log(`\n新建 ${created.length} 项，跳过 ${actions.length - created.length} 项。`);
  console.log(`
下一步：
  1. 填 .research/config.yml 的 TODO（禁区路径、交付目录、额度 API 归属）
  2. 如果是 git 仓库建议先 git init；技能根 <工作区>/.agents/skills 会被 DSH 按项目根扫描
  3. 开会话跑一个任务，结束时 node check.mjs 自检
`);
}

try {
  main();
} catch (error) {
  console.error(`init 失败: ${error.message}`);
  process.exit(1);
}
