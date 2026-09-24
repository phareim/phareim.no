/**
 * Brings this browser's Neon Shrine save and the profile's copy into step:
 * the newer one wins, best times meet at the lower. Skipped for a browser
 * with no player yet — its first save creates one. The world shell starts
 * on the local save at once and runs this in the background.
 */
import type { useGameSave } from '~/composables/useGameSave'
import { parseSave } from './engine/index'
import { reconcile } from './progress'
import { readLocalSave, writeLocalSave, clearLocalSave, localSavedAt, readLocalBest, writeLocalBest } from './localSave'
import type { SaveData } from './types'

type ProfileSave = ReturnType<typeof useGameSave>

/**
 * Returns the save the profile replaced the local one with (null: the
 * profile has no run), or undefined when the local copy stands. `ownsSave`
 * is asked once the profile answers: a run that has written since owns the
 * save, and its own writes go up.
 */
export async function syncWithProfile(profileSave: ProfileSave, ownsSave: () => boolean): Promise<{ save: SaveData | null } | undefined> {
  if (!profileSave.hasPlayer()) return undefined
  let local = readLocalSave()
  if (local && !local.savedAt) {
    // A save from before profile sync: stamp it now so it counts.
    local = { ...local, savedAt: Date.now() }
    writeLocalSave(local)
  }
  const remote = await profileSave.pull()
  if (remote === 'offline') return undefined

  const localBest = readLocalBest()
  if (remote?.best != null && (localBest === null || remote.best < localBest)) writeLocalBest(remote.best)
  else if (localBest !== null && (remote?.best == null || localBest < remote.best)) profileSave.push({ savedAt: Date.now(), best: localBest })

  if (ownsSave()) return undefined
  const remoteData = remote?.data ? parseSave(remote.data) : null
  const action = reconcile(local, localSavedAt(local), remote, remoteData)
  if (action.kind === 'push') {
    profileSave.push({ data: action.save, savedAt: action.savedAt })
    return undefined
  }
  if (action.kind !== 'pull') return undefined
  if (action.save) writeLocalSave({ ...action.save, savedAt: remote!.savedAt })
  else clearLocalSave(remote!.savedAt)
  return { save: action.save }
}
