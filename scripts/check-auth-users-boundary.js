#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const repositoryRoot = path.resolve(__dirname, '..')
const contentRoots = ['src', 'docs']
const fixtureRoot = path.join(__dirname, 'fixtures', 'auth-users-boundary')
const qualifiedAuthUsers = '(?:"auth"|auth)\\s*\\.\\s*(?:"users"|users)'
const readOnlyDiagnosticMarker = 'auth-users-boundary: allow-read-only-diagnostic'

const prohibitedPatterns = [
  {
    id: 'write-auth-users',
    description: 'direct DML on auth.users bypasses the managed Auth API',
    expression: new RegExp(`\\b(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM|MERGE\\s+INTO|TRUNCATE(?:\\s+TABLE)?)\\s+(?:ONLY\\s+)?${qualifiedAuthUsers}(?=\\s|[;,) ]|$)`, 'i')
  },
  {
    id: 'read-auth-users',
    description: 'direct auth.users reads are limited to explicitly marked administrator diagnostics',
    expression: new RegExp(`(?<!DELETE\\s)\\b(?:FROM|JOIN)\\s+${qualifiedAuthUsers}(?=\\s|[;,) ]|$)`, 'i'),
    allowReadOnlyDiagnostic: true
  },
  {
    id: 'from-auth-users',
    description: ".from('auth.users') is not available through the generated API",
    expression: /\.from\(\s*(['"]|\x60)auth\.users\1\s*\)/i
  },
  {
    id: 'schema-auth-users',
    description: ".schema('auth').from('users') is not available through the generated API",
    expression: /\.schema\(\s*(['"]|\x60)auth\1\s*\)\s*\.from\(\s*(['"]|\x60)users\2\s*\)/i
  }
]

function collectMarkdownFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectMarkdownFiles(entryPath)
    return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : []
  })
}

function findViolations(content) {
  const violations = []
  const lines = content.split(/\r?\n/)

  for (const pattern of prohibitedPatterns) {
    const matcher = new RegExp(pattern.expression.source, 'ig')
    let match
    while ((match = matcher.exec(content)) !== null) {
      const line = content.slice(0, match.index).split(/\r?\n/).length
      if (pattern.allowReadOnlyDiagnostic) {
        const previousLines = content.slice(0, match.index).split(/\r?\n/).slice(-5)
        if (previousLines.some((previousLine) => previousLine.includes(readOnlyDiagnosticMarker))) continue
      }
      violations.push({
        id: pattern.id,
        description: pattern.description,
        line,
        source: lines[line - 1].trim()
      })
    }
  }

  return violations
}

function checkContentFiles() {
  return contentRoots.flatMap((contentRoot) =>
    collectMarkdownFiles(path.join(repositoryRoot, contentRoot)).flatMap((filePath) =>
      findViolations(fs.readFileSync(filePath, 'utf8')).map((violation) => ({
        ...violation,
        file: path.relative(repositoryRoot, filePath)
      }))
    )
  )
}

function checkFixtures() {
  const fixtures = [
    { file: 'allowed-read-only-diagnostic.sql', expected: [] },
    { file: 'negative-insert-auth-users.sql', expected: ['write-auth-users'] },
    { file: 'negative-update-auth-users.sql', expected: ['write-auth-users'] },
    { file: 'negative-delete-auth-users.sql', expected: ['write-auth-users'] },
    { file: 'negative-read-auth-users.sql', expected: ['read-auth-users'] },
    { file: 'negative-from-auth-users.ts', expected: ['from-auth-users'] },
    { file: 'negative-from-auth-users-template.ts', expected: ['from-auth-users'] },
    { file: 'negative-schema-auth-users.ts', expected: ['schema-auth-users'] },
    { file: 'negative-schema-auth-users-template.ts', expected: ['schema-auth-users'] }
  ]

  const failures = []
  for (const fixture of fixtures) {
    const fixturePath = path.join(fixtureRoot, fixture.file)
    const actual = findViolations(fs.readFileSync(fixturePath, 'utf8')).map(({ id }) => id)
    if (JSON.stringify(actual) !== JSON.stringify(fixture.expected)) {
      failures.push(`${fixture.file}: expected ${fixture.expected.join(', ') || 'no violations'}, got ${actual.join(', ') || 'no violations'}`)
    }
  }

  return failures
}

function main() {
  const fixtureFailures = checkFixtures()
  const violations = checkContentFiles()

  if (fixtureFailures.length > 0 || violations.length > 0) {
    console.error('auth.users boundary check failed.')
    fixtureFailures.forEach((failure) => console.error(`fixture: ${failure}`))
    violations.forEach((violation) => {
      console.error(`${violation.file}:${violation.line}: ${violation.description}: ${violation.source}`)
    })
    process.exitCode = 1
    return
  }

  console.log('auth.users boundary check passed (8 negative fixtures, one marked diagnostic fixture, src/docs scanned).')
}

main()
