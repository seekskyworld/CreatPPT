// 校验发布 tag 与 package.json 版本一致，避免把错误版本发布到 npm。
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const tag = process.argv[2] || process.env.GITHUB_REF_NAME

if (!tag) {
  console.error('Missing release tag. Pass v<version> as the first argument.')
  process.exit(1)
}

const expectedTag = `v${packageJson.version}`
if (tag !== expectedTag) {
  console.error(`Release tag ${tag} does not match package version ${expectedTag}.`)
  process.exit(1)
}

console.log(`Release version check passed: ${tag}`)
