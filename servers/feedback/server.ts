/**
 * Starts the feedback service: 127.0.0.1:3057 (FEEDBACK_PORT), PM2 name
 * phareim-feedback, nginx serves it as https://sleeper.phareim.no/feedback/.
 * Reads only FEEDBACK_ALLOWED_EMAILS, FEEDBACK_ALLOWED_USER_IDS,
 * FEEDBACK_PORT and FEEDBACK_ROOT from servers/feedback/.env. Auth is always
 * auth.phareim.no; there is no test hook here. Logs go to stdout and never
 * hold a cookie, token, email, address, text, save or picture.
 */
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createSessionChecker } from '../../server/utils/sessionCheck.ts'
import { startServer } from './app.ts'

dotenv.config({ override: true, quiet: true, path: join(dirname(fileURLToPath(import.meta.url)), '.env') })

const list = (v: string | undefined) => (v ?? '').split(',').map(s => s.trim()).filter(Boolean)
const allowedEmails = list(process.env.FEEDBACK_ALLOWED_EMAILS)
const allowedIds = list(process.env.FEEDBACK_ALLOWED_USER_IDS)
const port = Number(process.env.FEEDBACK_PORT) || 3057
const root = process.env.FEEDBACK_ROOT || join(homedir(), 'data', 'feedback')
const log = (line: string) => console.log(`[feedback] ${line}`)

log('auth=auth.phareim.no')
if (!allowedEmails.length && !allowedIds.length) log('no allowed accounts: refusing everyone')

const s = await startServer({ port, host: '127.0.0.1', root, auth: createSessionChecker(), allowedEmails, allowedIds, log })
log(`listening on 127.0.0.1:${s.port}`)
