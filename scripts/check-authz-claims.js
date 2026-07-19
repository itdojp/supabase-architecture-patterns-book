#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const repositoryRoot = path.resolve(__dirname, '..')
const contentRoots = ['src', 'docs']
const fixtureRoot = path.join(__dirname, 'fixtures', 'authz-claims')

const authorizationPatterns = [
  {
    id: 'user-metadata-authorization',
    description: 'user-controlled user_metadata must not provide tenant, role, or permission authorization input',
    expression: /\b(?:[A-Za-z_$][\w$]*\s*(?:\?\.\s*|\.\s*))?user_metadata\s*(?:\?\.\s*|\.\s*|\[\s*['"])(?:tenant_id|tenant_role|role|roles|permission|permissions|is_admin|admin)\b/gi
  },
  {
    id: 'bracket-user-metadata-authorization',
    description: 'bracket access to user-controlled user_metadata must not provide authorization input',
    expression: /\b[A-Za-z_$][\w$]*\s*(?:\?\.\s*)?\[\s*['"]user_metadata['"]\s*\]\s*(?:\?\.\s*|\.\s*|\[\s*['"])(?:tenant_id|tenant_role|role|roles|permission|permissions|is_admin|admin)\b/gi
  },
  {
    id: 'jwt-user-metadata-authorization',
    description: 'auth.jwt() must not read authorization input from user_metadata',
    expression: /auth\.jwt\(\)\s*->\s*['"]user_metadata['"]\s*->>?\s*['"](?:tenant_id|tenant_role|role|roles|permission|permissions|is_admin|admin)['"]/gi
  },
  {
    id: 'jwt-user-metadata-path-authorization',
    description: 'auth.jwt() path operators must not read authorization input from user_metadata',
    expression: /auth\.jwt\(\)\s*#>>?\s*['"]\{\s*user_metadata\s*,\s*(?:tenant_id|tenant_role|role|roles|permission|permissions|is_admin|admin)\s*\}['"]/gi
  }
]

const falseAssurancePatterns = [
  {
    id: 'claim-updates-are-immediate',
    description: 'authorization claim updates must not be described as immediately reflected',
    expression: /(?:認可)?claim[^\n。]{0,12}(?:変更|更新)[^\n。]{0,16}(?:即時に?|直ちに)[^\n。]{0,40}(?:反映|有効)(?:される|されます|になる|なります|です)/gi
  },
  {
    id: 'signout-invalidates-access-token-immediately',
    description: 'sign out must not be described as immediately invalidating an issued access token',
    expression: /(?:sign\s*out|サインアウト)で(?:既発行の?)?(?:access token|アクセストークン)(?:も|は)?(?:即時に?|直ちに)?(?:無効|失効)(?:になる|になります|される|されます)/gi
  },
  {
    id: 'getuser-refreshes-rls-claims',
    description: 'getUser freshness must not be extended to RLS JWT claims',
    expression: /getUser[^\n。]{0,30}(?:なら|を使えば)[^\n。]{0,30}(?:RLS|auth\.jwt)[^\n。]{0,30}(?:最新|即時反映)(?:になる|になります|です|される|されます)/gi
  }
]

const staleClaimFixtureMarkers = [
  'app_metadata',
  'token refresh または再認証',
  '高リスク',
  'authoritativeなmembership/revocation'
]

const requiredContentContracts = [
  {
    paths: ['src/chapters/chapter02/index.md', 'docs/chapters/chapter02/index.md'],
    markers: [
      "auth.jwt() -> 'app_metadata' ->> 'tenant_id'",
      '`user_metadata` は表示名・アバター・UI設定などprofile/UI用途に限定し',
      'token refresh または再認証まで古いclaimを含み得ます',
      'JWTだけのRLSで「即時失効」とは主張しません'
    ]
  },
  {
    paths: ['src/chapters/chapter04/index.md', 'docs/chapters/chapter04/index.md'],
    markers: [
      'const tenantId = user.app_metadata?.tenant_id',
      'user_metadataをfallbackにしない',
      '更新後のuser recordを参照できます',
      '`auth.jwt()` を使うRLSのclaimも既発行tokenのままです',
      '既発行access tokenはsign out後も期限まで有効であり得る'
    ]
  },
  {
    paths: ['src/chapters/chapter05-4/index.md', 'docs/chapters/chapter05-4/index.md'],
    markers: [
      "auth.jwt() -> 'app_metadata' ->> 'tenant_id'",
      '`user_metadata` のtenant/role値を使ったりfallbackにしたりしません',
      'token refresh または再認証後に反映されます',
      'authoritativeなmembership/revocation状態を毎回照会'
    ]
  },
  {
    paths: ['src/chapters/chapter07/index.md', 'docs/chapters/chapter07/index.md'],
    markers: [
      'server-controlled `app_metadata`',
      '`user_metadata` をRLS/Edge Functionの認可条件やfallbackに使わない',
      'authoritativeなmembership/revocation照会で即時拒否'
    ]
  },
  {
    paths: ['src/appendices/appendix01/index.md', 'docs/appendices/appendix01/index.md'],
    markers: [
      'user自身が `user_metadata` のtenant/role値を更新してもRLS/Edge Functionの認可結果を変えられない',
      'claim変更前JWT、token refresh/re-auth後JWT',
      'authoritativeなmembership/revocation拒否'
    ]
  }
]

function collectMarkdownFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectMarkdownFiles(entryPath)
    return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : []
  })
}

function lineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/).length
}

function findAuthorizationViolations(content) {
  const violations = []
  const lines = content.split(/\r?\n/)

  for (const pattern of authorizationPatterns) {
    const matcher = new RegExp(pattern.expression.source, pattern.expression.flags)
    let match
    while ((match = matcher.exec(content)) !== null) {
      const line = lineNumber(content, match.index)
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

function findFalseAssuranceViolations(content) {
  const violations = []
  const lines = content.split(/\r?\n/)
  for (const pattern of falseAssurancePatterns) {
    const matcher = new RegExp(pattern.expression.source, pattern.expression.flags)
    let match
    while ((match = matcher.exec(content)) !== null) {
      const line = lineNumber(content, match.index)
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

function findStaleClaimContractViolations(content) {
  const missing = staleClaimFixtureMarkers.filter((marker) => !content.includes(marker))
  return missing.length === 0 ? [] : [{ id: 'missing-stale-claim-contract', missing }]
}

function checkContentFiles() {
  return contentRoots.flatMap((contentRoot) =>
    collectMarkdownFiles(path.join(repositoryRoot, contentRoot)).flatMap((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8')
      return [...findAuthorizationViolations(content), ...findFalseAssuranceViolations(content)].map((violation) => ({
        ...violation,
        file: path.relative(repositoryRoot, filePath)
      }))
    })
  )
}

function checkRequiredContentContracts(contracts = requiredContentContracts) {
  const failures = []
  for (const contract of contracts) {
    for (const relativePath of contract.paths) {
      let content
      try {
        content = fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
      } catch (error) {
        failures.push(`${relativePath}: could not be read: ${error.code || error.message}`)
        continue
      }
      const missing = contract.markers.filter((marker) => !content.includes(marker))
      if (missing.length > 0) failures.push(`${relativePath}: missing required contract: ${missing.join(' | ')}`)
    }
  }
  return failures
}

function checkFixtures() {
  const fixtures = [
    { file: 'allowed-app-metadata-tenant.ts', expectedAuthorization: [], expectedStale: [] },
    { file: 'allowed-user-metadata-profile.ts', expectedAuthorization: [], expectedStale: [] },
    { file: 'negative-user-metadata-tenant-fallback.ts', expectedAuthorization: ['user-metadata-authorization'], expectedStale: [] },
    { file: 'negative-optional-user-metadata-tenant.ts', expectedAuthorization: ['user-metadata-authorization'], expectedStale: [] },
    { file: 'negative-user-metadata-role-rbac.sql', expectedAuthorization: ['jwt-user-metadata-authorization'], expectedStale: [] },
    { file: 'negative-bracket-user-metadata-tenant.ts', expectedAuthorization: ['bracket-user-metadata-authorization'], expectedStale: [] },
    { file: 'negative-user-metadata-path-rbac.sql', expectedAuthorization: ['jwt-user-metadata-path-authorization'], expectedStale: [] },
    { file: 'valid-stale-claim-contract.md', expectedAuthorization: [], expectedStale: [] },
    { file: 'negative-stale-claim-contract.md', expectedAuthorization: [], expectedStale: ['missing-stale-claim-contract'], expectedFalseAssurances: ['claim-updates-are-immediate'] },
    { file: 'negative-signout-access-token.md', expectedAuthorization: [], expectedStale: ['missing-stale-claim-contract'], expectedFalseAssurances: ['signout-invalidates-access-token-immediately'] },
    { file: 'negative-getuser-rls-freshness.md', expectedAuthorization: [], expectedStale: ['missing-stale-claim-contract'], expectedFalseAssurances: ['getuser-refreshes-rls-claims'] }
  ]

  const failures = []
  for (const fixture of fixtures) {
    const content = fs.readFileSync(path.join(fixtureRoot, fixture.file), 'utf8')
    const actualAuthorization = findAuthorizationViolations(content).map(({ id }) => id)
    const actualStale = fixture.file.endsWith('.md') ? findStaleClaimContractViolations(content).map(({ id }) => id) : []
    const actualFalseAssurances = findFalseAssuranceViolations(content).map(({ id }) => id)
    if (JSON.stringify(actualAuthorization) !== JSON.stringify(fixture.expectedAuthorization)) {
      failures.push(`${fixture.file}: authorization expected ${fixture.expectedAuthorization.join(', ') || 'no violations'}, got ${actualAuthorization.join(', ') || 'no violations'}`)
    }
    if (JSON.stringify(actualStale) !== JSON.stringify(fixture.expectedStale)) {
      failures.push(`${fixture.file}: stale-claim expected ${fixture.expectedStale.join(', ') || 'no violations'}, got ${actualStale.join(', ') || 'no violations'}`)
    }
    const expectedFalseAssurances = fixture.expectedFalseAssurances || []
    if (JSON.stringify(actualFalseAssurances) !== JSON.stringify(expectedFalseAssurances)) {
      failures.push(`${fixture.file}: false-assurance expected ${expectedFalseAssurances.join(', ') || 'no violations'}, got ${actualFalseAssurances.join(', ') || 'no violations'}`)
    }
  }
  const missingContractFailures = checkRequiredContentContracts([
    { paths: ['scripts/fixtures/authz-claims/does-not-exist.md'], markers: ['unreachable'] }
  ])
  if (missingContractFailures.length !== 1 || !missingContractFailures[0].includes('could not be read')) {
    failures.push('missing required contract file must produce one diagnostic failure without throwing')
  }
  return failures
}

function main() {
  const fixtureFailures = checkFixtures()
  const contractFailures = checkRequiredContentContracts()
  const violations = checkContentFiles()

  if (fixtureFailures.length > 0 || contractFailures.length > 0 || violations.length > 0) {
    console.error('Authorization claim boundary check failed.')
    fixtureFailures.forEach((failure) => console.error(`fixture: ${failure}`))
    contractFailures.forEach((failure) => console.error(`contract: ${failure}`))
    violations.forEach((violation) => console.error(`${violation.file}:${violation.line}: ${violation.description}: ${violation.source}`))
    process.exitCode = 1
    return
  }

  console.log('Authorization claim boundary check passed (src/docs scanned; alternate authorization syntax and false-assurance fixtures covered).')
}

main()
