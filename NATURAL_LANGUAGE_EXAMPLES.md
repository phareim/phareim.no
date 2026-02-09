# Natural Language RPG Examples

## How It Works

The RPG now understands natural language! The system:
1. Checks if your input is an exact command (like "go north")
2. If not, uses AI to parse your intent
3. Converts natural language to game actions
4. Executes the action

## Movement Examples

**Natural Language** → **Interpreted As**
- "I stroll northwards" → `go north`
- "head west" → `go west`
- "walk to the east" → `go east`
- "travel south" → `go south`
- "let's move north" → `go north`

## Conversation Examples

**Natural Language** → **Interpreted As**
- "I chat with Lysiander the wandering mage" → `talk to Lysiander the wandering mage`
- "greet the merchant" → `talk to merchant`
- "speak with the old hermit" → `talk to old hermit`
- "ask the guard about the ruins" → `talk to guard`

## Examination Examples

**Natural Language** → **Interpreted As**
- "I check out the trees" → `look trees`
- "examine the ancient statue" → `look ancient statue`
- "what's around me?" → `look`
- "look at the mysterious door" → `look mysterious door`

## Item Examples

**Natural Language** → **Interpreted As**
- "pick up the rusty sword" → `take rusty sword`
- "grab the healing potion" → `take healing potion`
- "I'll take the golden key" → `take golden key`
- "drink the healing potion" → `use healing potion`

## Inventory Examples

**Natural Language** → **Interpreted As**
- "what's in my bag?" → `inventory`
- "check my inventory" → `inventory`
- "what do I have?" → `inventory`

## Mixed Examples (Full Sentences)

✅ "I carefully pick up the glowing crystal and examine it"
- First action: `take glowing crystal`
- Then player can examine it separately

✅ "I approach the merchant and start chatting"
- Parsed as: `talk to merchant`

✅ "Let's head northward toward those mysterious ruins"
- Parsed as: `go north`

## Fallback Behavior

If the AI can't determine intent with confidence, it treats your input as general conversation and processes it through the AI game master. This means you can:

- Ask questions: "What is this place?"
- Make observations: "This forest feels eerie"
- Chat generally: "Hello! This is beautiful"

## Technical Details

- **Parser Model**: llama-3.3-70b (via Venice AI)
- **Confidence Levels**: high, medium, low
- **Fallback**: Exact commands always work
- **Processing Time**: ~1-2 seconds for natural language parsing

## Pro Tips

1. **Be specific with names**: "talk to Lysiander" works better than "talk to him"
2. **One action per command**: "take sword and go north" might only do the first action
3. **Exact commands still work**: "go north" is faster than "I stroll northwards"
4. **Character names**: Use the full name as shown in **double asterisks**

## Examples in Gameplay

```
> I stroll northwards through the misty forest
You move north to the Ancient Grove.

An **old hermit** sits by a fire. A *healing potion* lies nearby.

> I chat with the old hermit about the forest
**old hermit**: "Greetings, traveler. I don't believe we've met before..."

> pick up the healing potion
You pick up healing potion and add it to your inventory.

> I check out the fire
You examine the fire closely. The flames dance with an unusual blue tint...
```

## Testing Natural Language

Try these to test the system:
- "I wander westward"
- "let's talk to the merchant"
- "what's that glowing thing?" (will examine)
- "grab the sword please"
- "show me my stuff" (inventory)
