// pm2 entry for mw-world. pm2 copies the environment of the shell that runs
// `pm2 start` into the app (filter_env does not stop it in pm2 6), and agent
// shells carry every API key. So clear it before pm2 reads it: the app gets
// only the env below. Re-create with
//   pm2 delete mw-world; pm2 start ecosystem.config.cjs && pm2 save
// A plain `pm2 restart mw-world` (deploy.sh) keeps it. Never --update-env.
for (const k of Object.keys(process.env)) if (!k.startsWith('PM2_')) delete process.env[k]
const HOME = '/home/petter'
module.exports = {
  apps: [{
    name: 'mw-world',
    cwd: __dirname,
    script: 'server.ts',
    interpreter: 'node',
    node_args: '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    env: { HOME, USER: 'petter', LANG: 'en_US.UTF-8', PATH: '/usr/local/bin:/usr/bin:/bin' },
  }],
}
