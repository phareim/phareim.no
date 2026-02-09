import OpenAI from 'openai'

export interface ParsedIntent {
    action: 'move' | 'talk' | 'examine' | 'take' | 'use' | 'inventory' | 'help' | 'unknown'
    target?: string
    direction?: 'north' | 'south' | 'east' | 'west'
    originalCommand: string
    confidence: 'high' | 'medium' | 'low'
}

/**
 * Uses AI to parse natural language into game intents
 */
export async function parseNaturalLanguage(
    userInput: string,
    openai: OpenAI
): Promise<ParsedIntent> {
    try {
        const completion = await openai.chat.completions.create({
            model: 'llama-3.3-70b',
            messages: [
                {
                    role: 'system',
                    content: `You are a natural language parser for a text-based RPG game.
Parse user input into structured game commands.

VALID ACTIONS:
- move: Player wants to go somewhere (walk, stroll, head, travel, move, go)
- talk: Player wants to speak with an NPC (chat, speak, talk, ask, greet, converse)
- examine: Player wants to look at something (look, check, examine, inspect, observe)
- take: Player wants to pick up an item (take, get, grab, pick up, collect)
- use: Player wants to use an item (use, consume, drink, eat, equip, wield)
- inventory: Player wants to see inventory (inventory, bag, items, what do i have)
- help: Player wants help (help, commands, what can i do)
- unknown: Unclear intent or general conversation

DIRECTIONS (for move action):
- north, south, east, west (or variations like northward, to the north, etc.)

OUTPUT FORMAT (respond with ONLY valid JSON):
{
  "action": "move|talk|examine|take|use|inventory|help|unknown",
  "target": "character name or item name or thing to examine",
  "direction": "north|south|east|west (only if action is move)",
  "confidence": "high|medium|low"
}

EXAMPLES:

Input: "I chat with Lysiander the wandering mage"
Output: {"action":"talk","target":"Lysiander the wandering mage","confidence":"high"}

Input: "I check out the trees"
Output: {"action":"examine","target":"trees","confidence":"high"}

Input: "I stroll northwards"
Output: {"action":"move","direction":"north","confidence":"high"}

Input: "head west"
Output: {"action":"move","direction":"west","confidence":"high"}

Input: "pick up the rusty sword"
Output: {"action":"take","target":"rusty sword","confidence":"high"}

Input: "what's in my bag?"
Output: {"action":"inventory","confidence":"high"}

Input: "speak with the merchant"
Output: {"action":"talk","target":"merchant","confidence":"high"}

Input: "look around"
Output: {"action":"examine","confidence":"high"}

Input: "Hello, how are you?"
Output: {"action":"unknown","confidence":"high"}

Parse the following user input:`
                },
                {
                    role: 'user',
                    content: userInput
                }
            ],
            temperature: 0.3,  // Low temperature for consistent parsing
            max_tokens: 100
        })

        const response = completion.choices[0]?.message?.content?.trim()
        if (!response) {
            throw new Error('No response from AI')
        }

        // Parse JSON response
        const parsed = JSON.parse(response)

        return {
            action: parsed.action || 'unknown',
            target: parsed.target,
            direction: parsed.direction,
            originalCommand: userInput,
            confidence: parsed.confidence || 'low'
        }

    } catch (error) {
        console.error('Error parsing natural language:', error)
        // Fallback: treat as unknown/general conversation
        return {
            action: 'unknown',
            originalCommand: userInput,
            confidence: 'low'
        }
    }
}

/**
 * Checks if a command is an exact/direct command (doesn't need parsing)
 */
export function isExactCommand(command: string): boolean {
    const firstWord = command.trim().toLowerCase().split(' ')[0]

    const exactCommands = [
        'go', 'move', 'walk', 'run', 'travel',
        'look', 'examine', 'inspect',
        'take', 'get', 'pick', 'pickup', 'grab',
        'use', 'consume', 'drink', 'eat',
        'talk', 'speak', 'chat', 'ask', 'tell', 'greet',
        'inventory', 'inv', 'i',
        'help', 'commands', '?'
    ]

    return exactCommands.includes(firstWord)
}

/**
 * Converts a parsed intent back into a standard command format
 */
export function intentToCommand(intent: ParsedIntent): string {
    switch (intent.action) {
        case 'move':
            return `go ${intent.direction}`
        case 'talk':
            return `talk to ${intent.target || ''}`
        case 'examine':
            return intent.target ? `look ${intent.target}` : 'look'
        case 'take':
            return `take ${intent.target || ''}`
        case 'use':
            return `use ${intent.target || ''}`
        case 'inventory':
            return 'inventory'
        case 'help':
            return 'help'
        case 'unknown':
        default:
            // Return original command for AI processing
            return intent.originalCommand
    }
}
