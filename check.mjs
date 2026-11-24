#!/usr/bin/env node
/**
 * research paradigm · by WTD — workspace self-check.
 *
 * Mechanically verifiable only: structure, run-log discipline, task three-piece
 * completeness, config placeholders, INDEX freshness. Research quality is not
 * something a script can judge.
 *
 * Zero dependencies.
 *
 *   node check.mjs [--dir <path>] [--json] [--write-index] [--help]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RULE_SHARDS = [
  '00-core.md',
  '10-retrieval.md',
  '20-logging.md',
  '30-failure.md',
  '40-delivery.md',
  '50-governance.md',
];
const SKILLS = ['rp-brief', 'rp-retrieval', 'rp-run-log', 'rp-handoff', 'rp-deliverable-check'];
const MARKER = '<!-- rp-kit:start -->';
const TABLE_HEAD = '| 时间 | 状态 | 说明 |';
const RUNS_SCAN = 10;

function usage() {
  console.log(`research paradigm · by WTD — check

用法:
  node check.mjs [--dir <path>] [--json] [--write-index]

  --dir <path>     工作区，默认当前目录
  --json           机器可读输出
  --write-index    重生成 runs/INDEX.md 后照常自检
`);
}

function parseArgs(argv) {
  const opts = { dir: process.cwd(), json: false, writeIndex: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dir') opts.dir = argv[(i += 1)];
    else if (a === '--json') opts.json = true;
    else if (a === '--write-index') opts.writeIndex = true;
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

function readIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function listRuns(runsDir) {
  if (!fs.existsSync(runsDir)) return [];
  return fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'INDEX.md' && e.name !== 'README.md')
    .map((e) => {
      const file = path.join(runsDir, e.name);
      const stat = fs.statSync(file);
      return { file, name: e.name, mtime: stat.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function tableRows(text) {
  return text
    .split('\n')
    .filter((line) => line.trim().startsWith('|') && !line.includes('---') && !line.includes('| 时间 | 状态 |'));
}

function fmtLocal(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function summarizeRun(file) {
  const text = readIfExists(file) ?? '';
  const rows = tableRows(text);
  const cellsOf = (row) => row.split('|').map((c) => c.trim()).filter(Boolean);
  let status = '—';
  let note = '';
  let digest = '';
  for (const row of rows) {
    const cells = cellsOf(row);
    if (/^digest/i.test(cells[1] ?? '')) digest = cells[2] ?? '';
    else {
      status = cells[1] ?? '—';
      note = cells[2] ?? '';
    }
  }
  return {
    hasTable: text.includes(TABLE_HEAD),
    hasEnd: rows.some((r) => /结束|完成|closed|done/i.test(r)),
    hasDigest: digest !== '' || /digest\s*[:：]/i.test(text),
    status,
    note: (digest || note).slice(0, 60),
    lines: text.split('\n').length,
  };
}

function writeIndex(runsDir) {
  const runs = listRuns(runsDir);
  const lines = [
    '# runs 索引（脚本生成，勿手改）',
    '',
    `> 生成时间：${fmtLocal(Date.now())} ｜ 共 ${runs.length} 份`,
    '',
    '| 文件 | 最后更新 | 行数 | 最新状态 | 摘要 |',
    '|---|---|---|---|---|',
  ];
  for (const run of runs) {
    const s = summarizeRun(run.file);
    const when = fmtLocal(run.mtime);
    lines.push(`| ${run.name} | ${when} | ${s.lines} | ${s.status} | ${s.note.replace(/\|/g, '/')} |`);
  }
  fs.writeFileSync(path.join(runsDir, 'INDEX.md'), `${lines.join('\n')}\n`, 'utf8');
  return runs.length;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }
  const ws = path.resolve(opts.dir);
  const findings = [];
  const add = (level, name, detail) => findings.push({ level, name, detail });

  // 1. Structure
  for (const dir of ['.research', 'tasks', 'runs', 'output']) {
    if (!fs.existsSync(path.join(ws, dir))) add('error', '目录', `缺 ${dir}/`);
  }
  const rulesDir = path.join(ws, '.research', 'rules');
  const missingShards = RULE_SHARDS.filter((s) => !fs.existsSync(path.join(rulesDir, s)));
  if (missingShards.length > 0) add('error', '规则分片', `缺 ${missingShards.join(', ')}`);
  else add('ok', '规则分片', `${RULE_SHARDS.length} 片齐全`);

  // 2. AGENTS.md
  const agents = readIfExists(path.join(ws, 'AGENTS.md'));
  if (agents === null) add('error', 'AGENTS.md', '不存在（新会话不会自动读到约定）');
  else if (!agents.includes(MARKER)) add('warn', 'AGENTS.md', '不含 rp-kit 段，可能是手工文件');
  else add('ok', 'AGENTS.md', `含 rp-kit 段（${agents.length} 字符）`);

  // 3. Skills
  const skillRoot = path.join(ws, '.agents', 'skills');
  const userSkillRoot = path.join(os.homedir(), '.agents', 'skills');
  const present = SKILLS.filter((s) => fs.existsSync(path.join(skillRoot, s, 'SKILL.md')));
  const presentUser = SKILLS.filter((s) => fs.existsSync(path.join(userSkillRoot, s, 'SKILL.md')));
  if (present.length === SKILLS.length) add('ok', '技能', `${SKILLS.length} 个在工作区技能根`);
  else if (presentUser.length === SKILLS.length) add('ok', '技能', `${SKILLS.length} 个在用户技能根`);
  else {
    const missing = SKILLS.filter((s) => !present.includes(s) && !presentUser.includes(s));
    add('warn', '技能', `未找到 ${missing.join(', ')}（init --no-skills？或换个根装的）`);
  }

  // 4. config placeholders
  const configPath = path.join(ws, '.research', 'config.yml');
  const config = readIfExists(configPath);
  if (config === null) add('error', 'config.yml', '不存在');
  else {
    const todos = (config.match(/TODO/g) ?? []).length;
    if (todos > 0) add('warn', 'config.yml', `仍有 ${todos} 处 TODO`);
    else add('ok', 'config.yml', '无 TODO');
  }

  // 5. run logs
  const runsDir = path.join(ws, 'runs');
  const runs = listRuns(runsDir);
  if (runs.length === 0) add('warn', 'runs', '还没有留痕文件');
  else {
    let bad = 0;
    for (const run of runs.slice(0, RUNS_SCAN)) {
      const s = summarizeRun(run.file);
      if (!s.hasTable) {
        bad += 1;
        add('warn', 'runs', `${run.name} 缺表头 ${TABLE_HEAD}`);
      } else if (!s.hasEnd) {
        bad += 1;
        add('warn', 'runs', `${run.name} 无结束行`);
      }
    }
    const noDigest = runs.slice(0, RUNS_SCAN).filter((r) => !summarizeRun(r.file).hasDigest).length;
    if (bad === 0) add('ok', 'runs', `最近 ${Math.min(RUNS_SCAN, runs.length)} 份结束行齐全`);
    if (noDigest > 0) add('warn', 'runs', `${noDigest} 份缺 digest: 行`);
  }

  // 6. task three-piece completeness
  const tasksDir = path.join(ws, 'tasks');
  if (fs.existsSync(tasksDir)) {
    for (const entry of fs.readdirSync(tasksDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const taskDir = path.join(tasksDir, entry.name);
      const hasAgent = fs.existsSync(path.join(taskDir, 'AGENT.md'));
      const hasIndex = fs.existsSync(path.join(taskDir, 'CONTEXT_INDEX.md'));
      if (hasAgent && !hasIndex) add('warn', 'tasks', `${entry.name} 有 AGENT.md 缺 CONTEXT_INDEX.md`);
    }
    add('ok', 'tasks', '三件套完整性已扫描');
  }

  // 7. INDEX freshness
  const indexPath = path.join(runsDir, 'INDEX.md');
  if (opts.writeIndex) {
    const count = writeIndex(runsDir);
    add('ok', 'runs/INDEX.md', `已重生成（${count} 份）`);
  } else if (!fs.existsSync(indexPath)) add('warn', 'runs/INDEX.md', '不存在（跑一次 --write-index）');
  else if (runs.length > 0 && fs.statSync(indexPath).mtimeMs < runs[0].mtime) {
    add('warn', 'runs/INDEX.md', '比最新留痕旧，建议 --write-index');
  } else add('ok', 'runs/INDEX.md', '新鲜');

  const errors = findings.filter((f) => f.level === 'error');
  const warns = findings.filter((f) => f.level === 'warn');

  if (opts.json) {
    console.log(JSON.stringify({ workspace: ws, findings, errors: errors.length, warns: warns.length }, null, 2));
  } else {
    console.log(`\nresearch paradigm · by WTD — check   ${ws}\n`);
    for (const f of findings) {
      const tag = f.level.padEnd(5);
      console.log(`  ${tag} ${f.name.padEnd(12)} ${f.detail}`);
    }
    console.log(`\n结果：${errors.length} error / ${warns.length} warn`);
  }
  process.exit(errors.length > 0 ? 1 : 0);
}

try {
  main();
} catch (error) {
  console.error(`check 失败: ${error.message}`);
  process.exit(2);
}
