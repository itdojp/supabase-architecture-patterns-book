#!/usr/bin/env node
'use strict';

// Issue #165: bounded caller compatibility, NOT a substitute for npm audit.
// The two scoped overrides exceed upstream's ranges; keep the consumers fixed
// until a separately reviewed dependency update revalidates these contracts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const cli = require.resolve('markdownlint-cli/markdownlint.js');
const cliRequire = createRequire(cli);
const mathRequire = createRequire(require.resolve('micromark-extension-math'));

function checkScope(pkg) {
  assert.equal(pkg.devDependencies['markdownlint-cli'], '0.48.0');
  assert.deepEqual(pkg.overrides['markdownlint-cli@0.48.0'], { 'smol-toml': '1.9.1' });
  assert.deepEqual(pkg.overrides['micromark-extension-math@3.1.0'], { katex: '0.18.2' });
  for (const name of ['smol-toml', 'katex', 'markdownlint-cli', 'micromark-extension-math']) {
    assert.equal(Object.hasOwn(pkg.overrides, name), false, `no global/unversioned ${name} override`);
  }
  assert.equal(pkg.devDependencies['gh-pages'], '^6.3.0');
  assert.equal(pkg.scripts.deploy, 'gh-pages -d _site');
  assert.equal(pkg.scripts['check:security'], 'npm audit --omit=optional');
  assert.ok(pkg.scripts.test.split(' && ').includes('npm run check:security'));
}

test('dependency exceptions are scoped; deploy and unfiltered audit remain', () => checkScope(manifest));

const mutations = {
  'CLI version drift': p => { p.devDependencies['markdownlint-cli'] = '^0.49.1'; },
  'TOML version drift': p => { p.overrides['markdownlint-cli@0.48.0']['smol-toml'] = '1.6.1'; },
  'math version drift': p => { p.overrides['micromark-extension-math@3.1.0'].katex = '0.16.47'; },
  'TOML global scope': p => { p.overrides['smol-toml'] = '1.9.1'; },
  'math global scope': p => { p.overrides.katex = '0.18.2'; },
  'CLI unversioned scope': p => { p.overrides['markdownlint-cli'] = { 'smol-toml': '1.9.1' }; },
  'math unversioned scope': p => { p.overrides['micromark-extension-math'] = { katex: '0.18.2' }; },
  'publisher downgrade': p => { p.devDependencies['gh-pages'] = '6.1.1'; },
  'deploy removal': p => { delete p.scripts.deploy; },
  'audit level suppression': p => { p.scripts['check:security'] += ' --audit-level=critical'; },
  'audit removed from test': p => { p.scripts.test = 'npm run lint'; },
};
for (const [label, mutate] of Object.entries(mutations)) {
  test(`reject ${label}`, () => {
    const changed = structuredClone(manifest);
    mutate(changed);
    assert.throws(() => checkScope(changed));
  });
}

test('installed callers resolve the reviewed versions', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const expected = {
    'markdownlint-cli': '0.48.0', 'micromark-extension-math': '3.1.0',
    'smol-toml': '1.9.1', katex: '0.18.2', 'markdown-it': '14.3.3', 'js-yaml': '4.3.2',
  };
  for (const [name, version] of Object.entries(expected)) {
    assert.equal(lock.packages[`node_modules/${name}`].version, version, `${name} lock`);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version, version);
  }
  assert.equal(cliRequire.resolve('smol-toml'), require.resolve('smol-toml'));
  assert.equal(cliRequire.resolve('js-yaml'), require.resolve('js-yaml'));
  assert.equal(cliRequire.resolve('markdown-it'), require.resolve('markdown-it'));
  assert.equal(mathRequire.resolve('katex'), require.resolve('katex'));
});

for (const [label, source, expected] of [
  ['booleans', 'default = false\nMD041 = true\n', { default: false, MD041: true }],
  ['table', '[MD013]\nline_length = 120\n', { MD013: { line_length: 120 } }],
  ['array', 'flags = [true, false]\n', { flags: [true, false] }],
  ['table array', '[[rows]]\nid = 1\n[[rows]]\nid = 2\n', { rows: [{ id: 1 }, { id: 2 }] }],
]) {
  test(`TOML caller serialized values: ${label}`, () => {
    // 1.9.x uses null-prototype tables. The CLI consumes configuration values,
    // so this deliberately tests serialized values, not prototype identity.
    assert.deepEqual(JSON.parse(JSON.stringify(cliRequire('smol-toml').parse(source))), expected);
  });
}

test('TOML parser still rejects malformed input directly', () => {
  assert.throws(() => cliRequire('smol-toml').parse('default = [\n'));
});

for (const source of ['x^2 + y^2', '\\frac{1}{2}', '\\sum_{i=1}^{n} i']) {
  test(`math caller returns accessible MathML: ${source}`, () => {
    const output = mathRequire('katex').renderToString(source, { output: 'mathml', throwOnError: true });
    assert.match(output, /<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML"/);
    assert.match(output, /<annotation encoding="application\/x-tex">/);
  });
}

test('real CLI loads JSON/JSONC/YAML/TOML and rejects invalid configuration', t => {
  const parent = path.join(root, '.codex-local');
  fs.mkdirSync(parent, { recursive: true });
  const temp = fs.mkdtempSync(path.join(parent, 'dependency-compatibility-'));
  t.after(() => fs.rmSync(temp, { recursive: true }));
  fs.writeFileSync(path.join(temp, 'good.md'), '# Example\n\nText.\n');
  fs.writeFileSync(path.join(temp, 'bad.md'), 'Text without heading\n');
  const configs = {
    json: '{"default":false,"MD041":true}',
    jsonc: '{ // fixture\n"default":false,"MD041":true\n}',
    yaml: 'default: false\nMD041: true\n',
    toml: 'default = false\nMD041 = true\n',
  };
  const run = (config, file) => spawnSync(process.execPath, [cli, '--config', config, file], {
    cwd: temp, encoding: 'utf8', timeout: 30000,
  });
  for (const [ext, text] of Object.entries(configs)) {
    const config = path.join(temp, `rules.${ext}`);
    fs.writeFileSync(config, text);
    for (const file of ['good.md', 'bad.md']) {
      const result = run(config, file);
      assert.equal(result.status, file === 'good.md' ? 0 : 1, `${ext}/${file}: ${result.stderr}`);
      if (file === 'bad.md') assert.match(result.stderr, /MD041/);
    }
  }
  // CLI tries multiple parsers irrespective of extension. Use a fixture that
  // all parsers reject; invalid TOML alone may be a valid YAML scalar.
  for (const ext of ['toml', 'yml']) {
    const config = path.join(temp, `invalid.${ext}`);
    fs.writeFileSync(config, '[\n');
    const result = run(config, 'good.md');
    assert.equal(result.status, 4);
    assert.match(result.stderr, /Cannot read or parse config file/);
  }
});
