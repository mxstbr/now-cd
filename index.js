#!/usr/bin/env node

let { event, repo, branch } = require('ci-env')
const { warn } = require('prettycli')

if (!branch || !repo || !event) {
  warn(
    'your CI environment does not seem to be supported. Check https://github.com/siddharthkp/ci-env'
  )
  process.exit(0)
}

const deploy = require('./deploy')
const { getAlias, setAlias } = require('./alias')
const remove = require('./remove')
const build = require('./build')

const authorAndRepo = repo.replace('/', '-') // repo ~ siddharthkp/ci-env

/* alias according to branch name */
let alias
if (branch === 'master') alias = `${authorAndRepo}.now.sh`
else alias = `${authorAndRepo}-${branch}.now.sh`

const run = async alias => {
  /* Step 0: Set pending status on build */
  build.start()
  /* Step 1: Deploy to a new instance */
  const newInstance = await deploy()
  /* Step 2: Get the old deployment instance for this alias */
  const oldInstance = await getAlias(alias)
  /* Step 3: Map the alias to new instance */
  await setAlias(newInstance, alias)
  /* Step 4: Add github status */
  await build.pass(alias)
  /* Step 5: If it exists, delete the old instance */
  if (oldInstance && newInstance !== oldInstance) await remove(oldInstance)
}

/* Catch errors throughout the app for debugging */
process.on('unhandledRejection', async err => {
  console.log('unhandledRejection', err)
  await build.error()
  process.exit(1)
})

if (branch === 'master' || event === 'pull_request') {
  try {
    run(alias)
  } catch (err) {
    build.error()
    console.log(err)
  }
} else {
  warn('now-cd only works on push events')
}
