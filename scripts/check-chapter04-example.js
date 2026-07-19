#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const repositoryRoot = path.resolve(__dirname, '..')
const exampleRoot = 'examples/chapter04-ecommerce'
const functionRoot = `${exampleRoot}/supabase/functions/process-order`
const chapterPaths = [
  'src/chapters/chapter04/index.md',
  'docs/chapters/chapter04/index.md'
]
const entryPointPaths = ['README.md', 'QUICK-START.md']
const expectedAssets = [
  `${exampleRoot}/README.md`,
  `${exampleRoot}/supabase/config.toml`,
  `${exampleRoot}/supabase/migrations/20260719000000_create_order_example.sql`,
  `${exampleRoot}/supabase/seed.sql`,
  `${functionRoot}/catalog.json`,
  `${functionRoot}/catalog.ts`,
  `${functionRoot}/handler.ts`,
  `${functionRoot}/handler_test.ts`,
  `${functionRoot}/index.ts`,
  `${functionRoot}/order.ts`,
  `${functionRoot}/order_test.ts`,
  'scripts/smoke-chapter04-local.sh'
]
const contractStart = '<!-- chapter04-example-contract:start -->'
const contractEnd = '<!-- chapter04-example-contract:end -->'

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
}

function extractContract(content, relativePath) {
  const start = content.indexOf(contractStart)
  const end = content.indexOf(contractEnd)
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`${relativePath}: Chapter 4 example contract markers are missing or out of order`)
  }
  if (content.indexOf(contractStart, start + contractStart.length) !== -1) {
    throw new Error(`${relativePath}: Chapter 4 example contract start marker is duplicated`)
  }
  return content.slice(start, end + contractEnd.length).replace(/\r\n/g, '\n')
}

function checkExpectedAssets(failures) {
  for (const relativePath of expectedAssets) {
    const absolutePath = path.join(repositoryRoot, relativePath)
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      failures.push(`${relativePath}: required asset is missing`)
    } else if (fs.statSync(absolutePath).size === 0) {
      failures.push(`${relativePath}: required asset is empty`)
    }
  }
}

function checkPackageContract(failures) {
  const packageJson = JSON.parse(read('package.json'))
  const packageLock = JSON.parse(read('package-lock.json'))
  const expectedPins = { deno: '2.9.3', supabase: '2.109.1' }
  for (const [dependency, version] of Object.entries(expectedPins)) {
    if (packageJson.devDependencies?.[dependency] !== version) {
      failures.push(`package.json: devDependency ${dependency} must be exact-pinned to ${version}`)
    }
    if (packageLock.packages?.['']?.devDependencies?.[dependency] !== version) {
      failures.push(`package-lock.json: root devDependency ${dependency} must match exact pin ${version}`)
    }
  }

  const expectedAllowScripts = { 'deno@2.9.3': true }
  if (JSON.stringify(packageJson.allowScripts) !== JSON.stringify(expectedAllowScripts)) {
    failures.push('package.json: allowScripts must explicitly allow only deno@2.9.3')
  }
  const npmrcLines = read('.npmrc').split(/\r?\n/).filter(Boolean)
  if (JSON.stringify(npmrcLines) !== JSON.stringify(['strict-allow-scripts=true'])) {
    failures.push('.npmrc: strict-allow-scripts=true must be the only install-script policy')
  }

  const denoTest = packageJson.scripts?.['test:chapter04-example'] || ''
  if (!/^deno test(?:\s|$)/.test(denoTest) || !denoTest.includes(`${functionRoot}/`)) {
    failures.push('package.json: test:chapter04-example must run all process-order Deno tests')
  }
  if (/--allow-(?:all|read|write|net|env|run|sys|ffi|import)|(?:^|\s)-A(?:\s|$)/.test(denoTest)) {
    failures.push('package.json: Chapter 4 Deno tests must not receive I/O permissions')
  }
  if (packageJson.scripts?.['smoke:chapter04-local'] !== 'bash scripts/smoke-chapter04-local.sh') {
    failures.push('package.json: smoke:chapter04-local must use the guarded smoke script')
  }

  const npmTest = packageJson.scripts?.test || ''
  for (const requiredScript of ['check:chapter04-example', 'test:chapter04-example']) {
    if (!npmTest.includes(`npm run ${requiredScript}`)) {
      failures.push(`package.json: npm test must run ${requiredScript}`)
    }
  }
  if (npmTest.includes('smoke:chapter04-local')) {
    failures.push('package.json: npm test must not require Docker local-stack smoke')
  }
}

function parseSeedCatalog(seed) {
  const rows = []
  const rowPattern = /\(\s*(\d+)\s*,\s*'((?:''|[^'])*)'\s*,\s*(\d+)\s*,\s*\d+\s*\)/g
  let match
  while ((match = rowPattern.exec(seed)) !== null) {
    rows.push({
      product_id: Number(match[1]),
      name: match[2].replace(/''/g, "'"),
      unit_price_yen: Number(match[3])
    })
  }
  return rows
}

function validateCatalog(catalog, source, failures) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    failures.push(`${source}: catalog must be a non-empty array`)
    return
  }
  const ids = new Set()
  for (const [index, product] of catalog.entries()) {
    const keys = Object.keys(product).sort()
    if (JSON.stringify(keys) !== JSON.stringify(['name', 'product_id', 'unit_price_yen'])) {
      failures.push(`${source}[${index}]: fields must be product_id, name, unit_price_yen only`)
    }
    if (!Number.isSafeInteger(product.product_id) || product.product_id <= 0) {
      failures.push(`${source}[${index}]: product_id must be a positive integer`)
    }
    if (ids.has(product.product_id)) failures.push(`${source}: duplicate product_id ${product.product_id}`)
    ids.add(product.product_id)
    if (typeof product.name !== 'string' || product.name.length === 0) {
      failures.push(`${source}[${index}]: name must be non-empty`)
    }
    if (!Number.isSafeInteger(product.unit_price_yen) || product.unit_price_yen < 0) {
      failures.push(`${source}[${index}]: unit_price_yen must be a non-negative integer`)
    }
  }
}

function checkCatalogSeedSync(failures) {
  const catalog = JSON.parse(read(`${functionRoot}/catalog.json`))
  const seedCatalog = parseSeedCatalog(read(`${exampleRoot}/supabase/seed.sql`))
  validateCatalog(catalog, `${functionRoot}/catalog.json`, failures)
  validateCatalog(seedCatalog, `${exampleRoot}/supabase/seed.sql`, failures)
  if (JSON.stringify(seedCatalog) !== JSON.stringify(catalog)) {
    failures.push('seed.sql product id/name/price must exactly match the server-owned local catalog')
  }
}

function checkConfigAndImplementation(failures) {
  const config = read(`${exampleRoot}/supabase/config.toml`)
  const requiredConfig = [
    'LOCAL-ONLY / NONDEPLOY',
    'verify_jwt=false must never be used for a remote deployment',
    'project_id = "chapter04-ecommerce"',
    '[db.migrations]',
    '[db.seed]',
    'sql_paths = ["./seed.sql"]',
    '[functions.process-order]',
    'verify_jwt = false'
  ]
  for (const marker of requiredConfig) {
    if (!config.includes(marker)) failures.push(`config.toml: missing ${marker}`)
  }

  const entryPoint = read(`${functionRoot}/index.ts`)
  if (!entryPoint.includes('import { handleRequest } from "./handler.ts"')) {
    failures.push('process-order/index.ts: handler must be imported from handler.ts')
  }
  if (!entryPoint.includes('Deno.serve(handleRequest)')) {
    failures.push('process-order/index.ts: Deno.serve entrypoint is missing')
  }
  if (entryPoint.includes('request.method') || entryPoint.includes('new Response')) {
    failures.push('process-order/index.ts: HTTP handler logic must stay separated in handler.ts')
  }

  const handler = read(`${functionRoot}/handler.ts`)
  const order = read(`${functionRoot}/order.ts`)
  if (!handler.includes('export async function handleRequest(request: Request): Promise<Response>')) {
    failures.push('process-order/handler.ts: Request/Response handler contract is missing')
  }
  if (!order.includes('Object.hasOwn(item, "unit_price_yen")') ||
      !order.includes('prices are server-owned') ||
      !order.includes('findLocalProduct(productId)')) {
    failures.push('process-order/order.ts: client price rejection or authoritative catalog lookup is missing')
  }
  if (!order.includes('new Set(["product_id", "quantity"])')) {
    failures.push('process-order/order.ts: request item allowlist must contain only product_id and quantity')
  }
  if (!order.includes('new Set(["items"])') || !order.includes('Object.hasOwn(input, "unit_price_yen")')) {
    failures.push('process-order/order.ts: top-level request fields and client price must be rejected')
  }

  for (const relativePath of [
    `${functionRoot}/index.ts`,
    `${functionRoot}/handler.ts`,
    `${functionRoot}/order.ts`,
    `${functionRoot}/catalog.ts`
  ]) {
    const content = read(relativePath)
    if (/access-control-allow-origin|access-control-allow-methods|request\.method\s*===\s*["']OPTIONS["']/i.test(content)) {
      failures.push(`${relativePath}: browser CORS or OPTIONS handling is forbidden in this server-only example`)
    }
  }

  const handlerTest = read(`${functionRoot}/handler_test.ts`)
  const requiredHandlerTests = [
    'POST uses the authoritative catalog',
    'POST rejects client unit_price_yen tampering',
    'POST rejects invalid JSON',
    'non-POST methods are rejected',
    'POST rejects an unknown product',
    'response.headers.get("access-control-allow-origin")'
  ]
  for (const marker of requiredHandlerTests) {
    if (!handlerTest.includes(marker)) failures.push(`handler_test.ts: missing coverage marker: ${marker}`)
  }

  const orderTest = read(`${functionRoot}/order_test.ts`)
  for (const marker of [
    'local catalog exposes the server-owned product identity and price',
    'rejects client-supplied unit_price_yen',
    'rejects a top-level client price field',
    'rejects an unknown product'
  ]) {
    if (!orderTest.includes(marker)) failures.push(`order_test.ts: missing coverage marker: ${marker}`)
  }

  const implementationFiles = expectedAssets.filter((relativePath) =>
    /\.(?:toml|sql|ts|json|sh)$/.test(relativePath)
  )
  const forbiddenImplementationPatterns = [
    { label: 'remote project token', expression: /SUPABASE_ACCESS_TOKEN|project_ref/i },
    { label: 'Stripe implementation or secret', expression: /stripe|STRIPE_SECRET/i },
    { label: 'SendGrid implementation or secret', expression: /sendgrid|SENDGRID_API/i },
    { label: 'secret-like value', expression: /\b(?:sk_(?:live|test)|sb_secret_)[A-Za-z0-9_-]+/ }
  ]
  for (const relativePath of implementationFiles) {
    const content = read(relativePath)
    for (const pattern of forbiddenImplementationPatterns) {
      if (pattern.expression.test(content)) {
        failures.push(`${relativePath}: contains forbidden ${pattern.label}`)
      }
    }
  }
}

function referencedExamplePaths(content) {
  return [...content.matchAll(/`(examples\/chapter04-ecommerce(?:\/[^`\n]*)?)`/g)]
    .map((match) => match[1].replace(/[.,:;]+$/, ''))
}

function checkLocalOnlyDocs(failures) {
  const documentationPaths = [...chapterPaths, ...entryPointPaths, `${exampleRoot}/README.md`]
  const forbiddenCommands = [
    { label: 'remote Supabase link command', expression: /^\s*(?:mise[^\n]*--\s*)?(?:npx(?:\s+--no-install)?\s+)?supabase\s+link\b/m },
    { label: 'remote Supabase Function deploy command', expression: /^\s*(?:mise[^\n]*--\s*)?(?:npx(?:\s+--no-install)?\s+)?supabase\s+functions\s+deploy\b/m },
    { label: 'Function env file flag', expression: /--env-file\b/ }
  ]
  for (const relativePath of documentationPaths) {
    const content = read(relativePath)
    for (const pattern of forbiddenCommands) {
      if (pattern.expression.test(content)) {
        failures.push(`${relativePath}: contains forbidden bundled-example ${pattern.label}`)
      }
    }
    if (/--data[^\n]*unit_price_yen/.test(content)) {
      failures.push(`${relativePath}: curl request must not send client unit_price_yen`)
    }
  }

  const exampleReadme = read(`${exampleRoot}/README.md`)
  for (const marker of [
    'LOCAL-ONLY / NONDEPLOY',
    'server-owned local catalog',
    'clientが `unit_price_yen` を送信した場合は値が正しくても拒否',
    'DBからauthoritativeな商品価格を同一transaction内で',
    'remote projectへdeployしたりしない'
  ]) {
    if (!exampleReadme.includes(marker)) failures.push(`${exampleRoot}/README.md: missing safety marker: ${marker}`)
  }
}

function checkContentContract(failures) {
  const chapterContents = chapterPaths.map((relativePath) => ({
    relativePath,
    content: read(relativePath)
  }))
  let sourceContract
  let sourceHandsOn
  let sourceDesignPaths
  for (const chapter of chapterContents) {
    try {
      const contract = extractContract(chapter.content, chapter.relativePath)
      if (sourceContract === undefined) sourceContract = contract
      else if (contract !== sourceContract) {
        failures.push(`${chapter.relativePath}: Chapter 4 example contract differs from the src mirror`)
      }
    } catch (error) {
      failures.push(error.message)
    }

    const handsOnStart = '## 同梱教材を実際に動かす（local-only）'
    const handsOnEnd = '### 学習のポイント'
    const handsOnStartIndex = chapter.content.indexOf(handsOnStart)
    const handsOnEndIndex = chapter.content.indexOf(handsOnEnd, handsOnStartIndex)
    if (handsOnStartIndex === -1 || handsOnEndIndex === -1) {
      failures.push(`${chapter.relativePath}: synchronized local-only hands-on section is missing`)
    } else {
      const handsOn = chapter.content
        .slice(handsOnStartIndex, handsOnEndIndex)
        .replace(/\r\n/g, '\n')
      if (sourceHandsOn === undefined) sourceHandsOn = handsOn
      else if (handsOn !== sourceHandsOn) {
        failures.push(`${chapter.relativePath}: local-only hands-on section differs from the src mirror`)
      }
    }

    const designPaths = chapter.content
      .split(/\r?\n/)
      .filter((line) => /^\s*\/\/ 設計例（同梱外）: supabase\/functions\//.test(line))
    if (sourceDesignPaths === undefined) sourceDesignPaths = designPaths
    else if (JSON.stringify(designPaths) !== JSON.stringify(sourceDesignPaths)) {
      failures.push(`${chapter.relativePath}: design-only path inventory differs from the src mirror`)
    }

    const requiredSafetyMarkers = [
      'LOCAL-ONLY / NONDEPLOY',
      'client価格を拒否する',
      'DBからauthoritativeな商品価格を取得し',
      '同一\ntransactionで実行する必要があります'
    ]
    for (const marker of requiredSafetyMarkers) {
      if (!chapter.content.includes(marker)) {
        failures.push(`${chapter.relativePath}: missing Chapter 4 safety marker: ${marker}`)
      }
    }

    const forbiddenClaims = [
      'src/chapter04-ecommerce',
      '実際に動作する完全なECサイト',
      'Stripe（テストモード）との連携も含まれています',
      'supabase functions new process-order',
      'supabase secrets set STRIPE_SECRET_KEY='
    ]
    for (const claim of forbiddenClaims) {
      if (chapter.content.includes(claim)) {
        failures.push(`${chapter.relativePath}: stale path or executable overclaim remains: ${claim}`)
      }
    }

    const unmarkedDesignPaths = chapter.content
      .split(/\r?\n/)
      .filter((line) => /^\s*\/\/ supabase\/functions\//.test(line))
    if (unmarkedDesignPaths.length > 0) {
      failures.push(`${chapter.relativePath}: design-only function paths must be marked 設計例（同梱外）`)
    }
  }

  for (const relativePath of [...chapterPaths, ...entryPointPaths]) {
    const content = read(relativePath)
    if (!content.includes(exampleRoot)) {
      failures.push(`${relativePath}: Chapter 4 example entry path is missing`)
    }
    for (const referencedPath of referencedExamplePaths(content)) {
      if (!fs.existsSync(path.join(repositoryRoot, referencedPath))) {
        failures.push(`${relativePath}: referenced example path does not exist: ${referencedPath}`)
      }
    }
  }
}

function main() {
  const failures = []
  checkExpectedAssets(failures)
  checkPackageContract(failures)
  checkCatalogSeedSync(failures)
  checkConfigAndImplementation(failures)
  checkLocalOnlyDocs(failures)
  checkContentContract(failures)

  if (failures.length > 0) {
    console.error('Chapter 4 example asset check failed.')
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exitCode = 1
    return
  }

  console.log(
    `Chapter 4 security contract check passed (${expectedAssets.length} assets; catalog/seed synchronized; handler tests and local-only src/docs contract verified).`
  )
}

main()
