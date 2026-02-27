import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import OpenAI from 'openai'
import type { GameState } from '../state/game-state'
import {
    getCharacter,
    initializeCharacter,
    addToCharacterConversation,
    getRelationshipDescription
} from './characters'

/**
 * Handles a conversation with a specific NPC using their remembered history
 */
export async function handleCharacterConversation(
    characterName: string,
    userMessage: string,
    gameState: GameState,
    openai: OpenAI,
    db: D1Database
): Promise<string> {
    let character = await getCharacter(characterName, db)

    if (!character) {
        console.log(`Character ${characterName} not found in database, initializing...`)
        await initializeCharacter(
            characterName,
            'A mysterious figure',
            'Enigmatic and cautious',
            gameState.coordinates,
            db
        )
        character = await getCharacter(characterName, db)
    }

    if (!character) {
        return `${characterName} seems distracted and doesn't respond.`
    }

    const systemPrompt: ChatCompletionMessageParam = {
        role: 'system',
        content: `You are roleplaying as "${characterName}" in a fantasy text RPG.

Character Details:
- Name: ${characterName}
- Description: ${character.description}
- Personality: ${character.personality || 'Friendly and helpful'}
- Current Mood: ${character.mood || 'neutral'}
- Relationship with player: ${getRelationshipDescription(character.relationshipLevel || 0)} (${character.relationshipLevel || 0}/100)
- Times spoken to: ${character.timesSpokenTo || 0}

Important Rules:
1. Stay in character at all times
2. Remember your previous conversations (they're provided in the history)
3. Your mood and relationship level affect how you respond
4. Be conversational and natural - this is dialogue, not narration
5. Keep responses concise (2-4 sentences)
6. If relationship is high, be warm and helpful
7. If relationship is low, be curt or suspicious
8. Reference past conversations naturally when relevant
9. You can mention items using *asterisks* if you want to give them to the player
10. You can refuse requests, lie, or be unhelpful if it fits your character and relationship level

Examples of good responses:
- High relationship: "Ah, my friend! Of course I remember you. What brings you back to see me?"
- Low relationship: "You again? What do you want this time?"
- Neutral, first meeting: "Greetings, traveler. I don't believe we've met before."
- Referencing past: "Last time we spoke, you mentioned the ancient ruins. Did you ever find them?"`
    }

    const messages: ChatCompletionMessageParam[] = [
        systemPrompt,
        ...character.conversationHistory,
        { role: 'user', content: userMessage }
    ]

    try {
        const completion = await openai.chat.completions.create({
            model: 'llama-3.3-70b',
            messages,
            temperature: 0.8,
            max_tokens: 300
        })

        const npcResponse = completion.choices[0]?.message?.content ||
            `${characterName} nods but doesn't say anything.`

        await addToCharacterConversation(characterName, userMessage, npcResponse, db)

        return `**${characterName}**: "${npcResponse}"`
    } catch (error) {
        console.error('Error in character conversation:', error)
        return `${characterName} seems distracted and doesn't respond clearly.`
    }
}

/**
 * Handles asking a character about a specific topic
 */
export async function handleCharacterQuestion(
    characterName: string,
    topic: string,
    gameState: GameState,
    openai: OpenAI,
    db: D1Database
): Promise<string> {
    const userMessage = `Tell me about ${topic}`
    return handleCharacterConversation(characterName, userMessage, gameState, openai, db)
}
