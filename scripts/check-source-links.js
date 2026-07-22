#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const MarkdownIt = require('markdown-it');

const repoRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(repoRoot, 'src');
const docsRoot = path.join(repoRoot, 'docs');
const manifestPath = path.join(repoRoot, '.qa', 'source-markdown-files.json');
const docsOnlyManifestPath = path.join(repoRoot, '.qa', 'docs-only-markdown-files.json');
const excludedDocsManifestPath = path.join(repoRoot, '.qa', 'excluded-docs-markdown-files.json');
const cliPath = path.join(repoRoot, 'node_modules', 'markdown-link-check', 'markdown-link-check');
const markdown = new MarkdownIt({ html: true, linkify: false });
const siteRepositoryUrl = (() => {
  const config = fs.readFileSync(path.join(docsRoot, '_config.yml'), 'utf8');
  const match = config.match(/^repository:\s*["']?([^"'\s]+)["']?\s*$/m);
  if (!match) fail('docs/_config.yml must define repository for Liquid link validation');
  return match[1].replace(/\/$/, '');
})();

const builtFragmentContracts = {
  'guides/error-handling/index.html': ['認証認可エラー', 'ネットワーク接続エラー', 'エラー監視ログ'],
  'guides/pattern-selection/index.html': ['実装難易度コスト分析', '成功事例ケーススタディ'],
  'guides/troubleshooting/index.html': ['接続認証問題'],
};

function fail(message) {
  throw new Error(message);
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function discoverMarkdown(dir, base = repoRoot) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...discoverMarkdown(absolute, base));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(toPosix(path.relative(base, absolute)));
    }
  }
  return files.sort();
}

function loadManifest(filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    fail(`${path.relative(repoRoot, filePath)} must contain a JSON string array`);
  }
  const label = toPosix(path.relative(repoRoot, filePath));
  if (new Set(value).size !== value.length) fail(`${label} contains duplicates`);
  if (JSON.stringify(value) !== JSON.stringify([...value].sort())) fail(`${label} must be sorted`);
  return value;
}

function assertManifest() {
  const expected = loadManifest(manifestPath);
  const actual = discoverMarkdown(sourceRoot);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const missing = expected.filter((file) => !actual.includes(file));
    const untracked = actual.filter((file) => !expected.includes(file));
    fail(`source Markdown inventory mismatch: missing=${JSON.stringify(missing)}, untracked=${JSON.stringify(untracked)}`);
  }
  const docsOnly = loadManifest(docsOnlyManifestPath);
  const excludedDocs = loadManifest(excludedDocsManifestPath);
  for (const file of docsOnly) {
    const absolute = path.join(repoRoot, file);
    if (!file.startsWith('docs/') || !file.endsWith('.md') || !fs.existsSync(absolute)) {
      fail(`invalid docs-only Markdown inventory entry: ${file}`);
    }
    const sourceCounterpart = path.join(sourceRoot, path.relative(path.join(repoRoot, 'docs'), absolute));
    if (fs.existsSync(sourceCounterpart)) fail(`${file} has a src counterpart and is not docs-only`);
  }
  const expectedDocs = [
    ...actual.map((file) => `docs/${toPosix(path.relative(sourceRoot, path.join(repoRoot, file)))}`),
    ...docsOnly,
    ...excludedDocs,
  ].sort();
  const actualDocs = discoverMarkdown(docsRoot);
  if (JSON.stringify(actualDocs) !== JSON.stringify(expectedDocs)) {
    const missing = expectedDocs.filter((file) => !actualDocs.includes(file));
    const unclassified = actualDocs.filter((file) => !expectedDocs.includes(file));
    fail(`docs Markdown classification mismatch: missing=${JSON.stringify(missing)}, unclassified=${JSON.stringify(unclassified)}`);
  }
  const combined = [...actual, ...docsOnly];
  if (new Set(combined).size !== combined.length) fail('combined canonical Markdown inventory contains duplicates');
  console.log(`Inventory: ${actual.length} source + ${docsOnly.length} docs-only canonical; ${excludedDocs.length} docs helper excluded`);
  return combined;
}

function runChecker(files, config, { quiet = false, cwd = repoRoot } = {}) {
  if (!fs.existsSync(cliPath)) fail('markdown-link-check is not installed; run npm ci');
  const result = spawnSync(process.execPath, [cliPath, '-c', config, ...files], {
    cwd,
    encoding: 'utf8',
    stdio: quiet ? 'pipe' : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status === null) {
    console.error(`checker terminated without an exit status${result.signal ? ` (signal: ${result.signal})` : ''}`);
    return 1;
  }
  return result.status;
}

function visitTokens(tokens, visitor) {
  for (const token of tokens) {
    visitor(token);
    if (token.children) visitTokens(token.children, visitor);
  }
}

function extractLinks(filePath) {
  const links = [];
  const tokens = markdown.parse(fs.readFileSync(filePath, 'utf8'), {});
  visitTokens(tokens, (token) => {
    if (token.type === 'link_open') {
      const href = token.attrGet('href');
      if (href) links.push(href);
    } else if (token.type === 'image') {
      const src = token.attrGet('src');
      if (src) links.push(src);
    } else if (token.type === 'html_inline' || token.type === 'html_block') {
      for (const match of token.content.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
        links.push(match[1]);
      }
    }
  });
  for (const token of tokens) {
    if (token.type !== 'inline') continue;
    const text = (token.children || [])
      .filter((child) => child.type === 'text')
      .map((child) => child.content)
      .join('');
    for (const match of text.matchAll(/\]\(\{\{\s*["']([^"']+)["']\s*\|\s*relative_url\s*\}\}(#[^)\s]+)?\)/g)) {
      links.push(`${match[1]}${match[2] || ''}`);
    }
    for (const match of text.matchAll(/\]\(\{\{\s*site\.baseurl\s*\}\}(\/[^)\s]+)\)/g)) {
      links.push(match[1]);
    }
    for (const match of text.matchAll(/\{\{\s*site\.repository\s*\}\}(\/[^\s)]+)/g)) {
      links.push(`${siteRepositoryUrl}${match[1]}`);
    }
  }
  return links;
}

function isExternal(link) {
  return /^(?:https?:)?\/\//i.test(link);
}

function isIgnoredScheme(link) {
  return /^(?:mailto|tel|data|javascript):/i.test(link);
}

function decodeLinkPart(value, label) {
  try {
    return decodeURIComponent(value);
  } catch {
    fail(`invalid percent encoding in ${label}: ${value}`);
  }
}

function resolveInternalTarget(sourceFile, rawLink) {
  const hashIndex = rawLink.indexOf('#');
  const pathAndQuery = hashIndex === -1 ? rawLink : rawLink.slice(0, hashIndex);
  const rawPath = pathAndQuery.split('?')[0];
  const rawFragment = hashIndex === -1 ? '' : rawLink.slice(hashIndex + 1);
  const decodedPath = decodeLinkPart(rawPath, 'link path');
  const fragment = decodeLinkPart(rawFragment, 'link fragment');
  const canonicalRoot = path.relative(docsRoot, sourceFile).startsWith('..') ? sourceRoot : docsRoot;
  const absolute = decodedPath.startsWith('/')
    ? path.join(canonicalRoot, decodedPath.replace(/^\/+/, ''))
    : path.resolve(path.dirname(sourceFile), decodedPath || '.');

  const candidates = [];
  if (decodedPath === '') {
    candidates.push(sourceFile);
  } else {
    candidates.push(path.join(absolute, 'index.md'));
    if (!path.extname(absolute)) candidates.push(`${absolute}.md`);
    candidates.push(absolute);
  }
  const target = candidates.find((candidate) => fs.existsSync(candidate));
  return { target, fragment, attempted: candidates };
}

function headingText(inlineToken) {
  let value = '';
  visitTokens(inlineToken.children || [], (token) => {
    if (token.type === 'text' || token.type === 'code_inline') value += token.content;
  });
  return value;
}

function gfmHeadingIds(filePath) {
  if (!filePath.endsWith('.md')) return new Set();
  const tokens = markdown.parse(fs.readFileSync(filePath, 'utf8'), {});
  const counters = new Map();
  const ids = new Set();
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].type !== 'heading_open') continue;
    const explicitId = tokens[index].attrGet('id');
    if (explicitId) {
      ids.add(explicitId);
      continue;
    }
    const inline = tokens[index + 1];
    if (!inline || inline.type !== 'inline') continue;
    // kramdown-parser-gfm 1.1.0: downcase, remove non-Word characters
    // except hyphen/space/tab, then replace spaces/tabs with hyphens.
    let id = headingText(inline)
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- \t]/gu, '')
      .replace(/[ \t]/g, '-');
    const duplicate = counters.get(id) || 0;
    counters.set(id, duplicate + 1);
    if (duplicate > 0) id += `-${duplicate}`;
    ids.add(id);
  }
  visitTokens(tokens, (token) => {
    if (token.type !== 'html_inline' && token.type !== 'html_block') return;
    for (const match of token.content.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) ids.add(match[1]);
  });
  return ids;
}

function checkInternal(files) {
  const errors = [];
  const headingCache = new Map();
  let checked = 0;
  for (const relativeFile of files) {
    const sourceFile = path.join(repoRoot, relativeFile);
    for (const link of extractLinks(sourceFile)) {
      if (isExternal(link) || isIgnoredScheme(link)) continue;
      if (/\{[{%]/.test(link)) continue;
      checked += 1;
      const { target, fragment, attempted } = resolveInternalTarget(sourceFile, link);
      if (!target) {
        errors.push(`${relativeFile}: missing target ${link} (tried ${attempted.map((item) => toPosix(path.relative(repoRoot, item))).join(', ')})`);
        continue;
      }
      const relativeTarget = path.relative(repoRoot, target);
      if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
        errors.push(`${relativeFile}: target escapes repository: ${link}`);
        continue;
      }
      if (!fragment) continue;
      let ids = headingCache.get(target);
      if (!ids) {
        ids = gfmHeadingIds(target);
        headingCache.set(target, ids);
      }
      if (!ids.has(fragment)) {
        errors.push(`${relativeFile}: missing fragment #${fragment} in ${toPosix(path.relative(repoRoot, target))}`);
      }
    }
  }
  if (errors.length) fail(`internal link check failed (${errors.length}):\n${errors.join('\n')}`);
  console.log(`OK: ${checked} internal links/fragments across ${files.length} canonical Markdown files`);
}

function extractExternalLinks(files) {
  const urls = new Set();
  for (const file of files) {
    for (const link of extractLinks(path.join(repoRoot, file))) {
      if (/^https?:\/\//i.test(link)) urls.add(link);
    }
  }
  return [...urls].sort();
}

function checkExternal(files) {
  const urls = extractExternalLinks(files);
  if (!urls.length) fail('no external links were extracted from canonical source');
  const tempRoot = path.join(repoRoot, '.codex-local', 'tmp');
  fs.mkdirSync(tempRoot, { recursive: true });
  const tempFile = path.join(tempRoot, `source-external-links-${process.pid}.md`);
  try {
    fs.writeFileSync(tempFile, urls.map((url, index) => `[external-${index + 1}](${url})`).join('\n') + '\n');
    console.log(`External URL inventory: ${urls.length} unique URLs`);
    return runChecker([tempFile], path.join(repoRoot, '.markdown-link-check.external.json'));
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
}

function checkBuiltSite(siteRoot) {
  // main() validates the canonical inventory before this rendered contract.
  for (const [relativePath, fragments] of Object.entries(builtFragmentContracts)) {
    const filePath = path.join(siteRoot, relativePath);
    if (!fs.existsSync(filePath)) fail(`built page is missing: ${relativePath}`);
    const html = fs.readFileSync(filePath, 'utf8');
    for (const fragment of fragments) {
      if (!html.includes(`href="#${fragment}"`)) fail(`${relativePath} is missing href #${fragment}`);
      if (!html.includes(`id="${fragment}"`)) fail(`${relativePath} is missing target id ${fragment}`);
    }
  }
  const chapter10 = fs.readFileSync(path.join(siteRoot, 'chapters', 'chapter10', 'index.html'), 'utf8');
  if (chapter10.includes('https://supabase.com/community')) fail('built Chapter 10 still contains the retired community URL');
  if (!chapter10.includes('https://github.com/supabase/supabase/discussions')) {
    fail('built Chapter 10 is missing the current Supabase Discussions URL');
  }
  console.log(`OK: built fragment/link contract (${Object.values(builtFragmentContracts).flat().length} fragments)`);
}

function selfTest() {
  const tempParent = path.join(repoRoot, '.codex-local', 'tmp');
  fs.mkdirSync(tempParent, { recursive: true });
  const fixtureRoot = fs.mkdtempSync(path.join(tempParent, 'source-link-self-test-'));
  try {
    fs.mkdirSync(path.join(fixtureRoot, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, 'index.md'), '[nested](nested/page.md#target)\n');
    fs.writeFileSync(path.join(fixtureRoot, 'nested', 'page.md'), '# Target\n\n[self](#target)\n');
    const files = discoverMarkdown(fixtureRoot, fixtureRoot);
    if (JSON.stringify(files) !== JSON.stringify(['index.md', 'nested/page.md'])) {
      fail(`nested fixture discovery failed: ${JSON.stringify(files)}`);
    }
    checkInternal(files.map((file) => toPosix(path.relative(repoRoot, path.join(fixtureRoot, file)))));
    fs.writeFileSync(path.join(fixtureRoot, 'nested', 'page.md'), '# Target\n\n[self](#missing)\n');
    let detected = false;
    try {
      checkInternal(files.map((file) => toPosix(path.relative(repoRoot, path.join(fixtureRoot, file)))));
    } catch (error) {
      detected = /missing fragment/.test(error.message);
    }
    if (!detected) fail('broken fragment in recursively discovered nested fixture must fail');
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
  console.log('OK: source link self-test (nested discovery + broken fragment)');
}

function parseArgs(argv) {
  const args = { mode: 'internal', selfTest: false, builtSite: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--self-test') args.selfTest = true;
    else if (argv[i] === '--mode' && argv[i + 1]) args.mode = argv[++i];
    else if (argv[i] === '--built-site' && argv[i + 1]) args.builtSite = path.resolve(repoRoot, argv[++i]);
    else fail(`unknown argument: ${argv[i]}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) return selfTest();
  const files = assertManifest();
  if (args.builtSite) return checkBuiltSite(args.builtSite);
  let status;
  if (args.mode === 'internal') {
    checkInternal(files);
    return;
  } else if (args.mode === 'external') {
    status = checkExternal(files);
  } else {
    fail(`unsupported mode: ${args.mode}`);
  }
  if (status !== 0) process.exit(status);
  console.log(`OK: ${args.mode} links checked across ${files.length} canonical Markdown files`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { discoverMarkdown, extractExternalLinks, checkInternal, checkBuiltSite, selfTest };
