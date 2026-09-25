/**
 * The house's people, one painter each (feet at the actor's x, y), in
 * render/npcs/<id>.ts. The Professor is drawn by the hero rig (actors.ts).
 */
import type { NpcPainter } from './api'
import { paint as bones } from './npcs/bones'
import { paint as hedvig } from './npcs/hedvig'
import { paint as gustav } from './npcs/gustav'
import { paint as cat } from './npcs/cat'
import { paint as bat } from './npcs/bat'

export const NPC_PAINTERS: Record<string, NpcPainter> = { bones, hedvig, gustav, cat, bat }
