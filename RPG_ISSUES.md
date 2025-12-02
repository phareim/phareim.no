# RPG System Issues and Improvements

## 🔴 High Priority Fixes

- [ ] 1. Fix missing `computed` import in InlinePlace.vue (components/rpg/InlinePlace.vue:75)
- [ ] 2. Consolidate state management - Choose either server-side OR client-side, not both
- [ ] 3. Remove the setTimeout race condition - Use proper Firebase listeners
- [ ] 4. Add userId validation in the API endpoint
- [ ] 5. Implement actual character spawning in places or remove the Character integration entirely

## 🟡 Medium Priority Improvements

- [ ] 6. Add a proper item pickup system with "take [item]" command
- [ ] 7. Make item properties functional - apply damage, healing, etc.
- [ ] 8. Create a help command that lists available actions
- [ ] 9. Improve place generation variety - different biomes, themes, danger levels
- [ ] 10. Add character spawning logic to populate NPCs in the world

## 🟢 Low Priority Enhancements

- [ ] 11. Add a quest system to give players goals
- [ ] 12. Implement basic combat using the existing stats
- [ ] 13. Add item usage with "use [item]" command
- [ ] 14. Create a progression system with XP and leveling
- [ ] 15. Add more item types beyond the current 6 categories

## 🏗️ Architectural Recommendations

- [ ] 16. Decouple the character gallery from RPG characters - they seem to be two different features
- [ ] 17. Pre-load adjacent items/characters when a place is described to avoid loading spinners
- [ ] 18. Add Redis caching for frequently accessed places
- [ ] 19. Implement batch Firebase reads instead of individual queries per inline element
- [ ] 20. Create a game engine service to handle combat, progression, and item effects

## 🐛 Critical Issues Found

- [ ] Fix visited array population - only updates on movement, not on initial spawn or look commands
- [ ] Characters collection is not integrated into the game - 34 characters exist but never spawn
- [ ] Dual state management creates confusion (gameStates vs games collections)
- [ ] Item generation is inconsistent - too many "misc" items
- [ ] Place generation lacks variety - repetitive naming patterns
- [ ] No character spawning system - location fields exist but unused
- [ ] Message history inconsistency between collections
- [ ] Inventory duplication possible in examination flow
- [ ] currentPlace caching is incomplete - only 1 of 9 players has it cached

## 🎯 Game Mechanics Issues

- [ ] No character interactions despite 34 characters in Firebase
- [ ] Items aren't truly interactive - no take/use commands
- [ ] No progression system (XP, leveling, quests)
- [ ] Combat doesn't exist despite weapon stats
- [ ] Character stats defined but unused (D&D ability scores)
- [ ] Item properties ignored (damage, defense, healing)
- [ ] Video animations for characters never used in RPG

## 🎨 UI/UX Issues

- [ ] Place interaction is confusing - "go to [place name]" doesn't work with AI
- [ ] Loading states everywhere - multiple Firebase calls per description
- [ ] No help system despite mention in system prompt
