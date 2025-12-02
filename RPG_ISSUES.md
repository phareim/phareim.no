# RPG System Issues and Improvements

## 🔴 High Priority Fixes

- [x] 1. Fix missing `computed` import in InlinePlace.vue (components/rpg/InlinePlace.vue:75) ✅
- [x] 2. Consolidate state management - Choose either server-side OR client-side, not both ✅
- [x] 3. Remove the setTimeout race condition - Use proper Firebase listeners ✅
- [x] 4. Add userId validation in the API endpoint ✅
- [x] 5. Implement actual character spawning in places or remove the Character integration entirely ✅

## 🟡 Medium Priority Improvements

- [x] 6. Add a proper item pickup system with "take [item]" command ✅
- [x] 7. Make item properties functional - apply damage, healing, etc. ✅
- [x] 8. Create a help command that lists available actions ✅
- [x] 9. Improve place generation variety - different biomes, themes, danger levels ✅
- [x] 10. Add character spawning logic to populate NPCs in the world ✅

## 🟢 Low Priority Enhancements

- [ ] 11. Add a quest system to give players goals
- [ ] 12. Implement basic combat using the existing stats
- [x] 13. Add item usage with "use [item]" command ✅
- [ ] 14. Create a progression system with XP and leveling
- [ ] 15. Add more item types beyond the current 6 categories

## 🏗️ Architectural Recommendations

- [x] 16. Decouple the character gallery from RPG characters - they seem to be two different features ✅
- [ ] 17. Pre-load adjacent items/characters when a place is described to avoid loading spinners
- [ ] 18. Add Redis caching for frequently accessed places
- [ ] 19. Implement batch Firebase reads instead of individual queries per inline element
- [ ] 20. Create a game engine service to handle combat, progression, and item effects

## 🐛 Critical Issues Found (Resolved)

- [x] Fix visited array population - only updates on movement, not on initial spawn or look commands ✅ (Works as designed)
- [x] Characters collection is not integrated into the game - 34 characters exist but never spawn ✅ (Clarified: separate feature)
- [x] Dual state management creates confusion (gameStates vs games collections) ✅ (Consolidated)
- [x] Item generation is inconsistent - too many "misc" items ✅ (Improved with probability system)
- [x] Place generation lacks variety - repetitive naming patterns ✅ (Added biome system)
- [x] No character spawning system - location fields exist but unused ✅ (Implemented)
- [x] Message history inconsistency between collections ✅ (Consolidated)
- [ ] Inventory duplication possible in examination flow (Low impact - deduplication works)
- [ ] currentPlace caching is incomplete - only 1 of 9 players has it cached (Optimizable later)

## 🎯 Game Mechanics Issues (Resolved)

- [x] No character interactions despite 34 characters in Firebase ✅ (NPCs now spawn dynamically)
- [x] Items aren't truly interactive - no take/use commands ✅ (Implemented take & use)
- [ ] No progression system (XP, leveling, quests) (Low priority)
- [ ] Combat doesn't exist despite weapon stats (Low priority)
- [ ] Character stats defined but unused (D&D ability scores) (For future combat system)
- [x] Item properties ignored (damage, defense, healing) ✅ (Now functional in use command)
- [ ] Video animations for characters never used in RPG (Gallery feature, not RPG)

## 🎨 UI/UX Issues (Resolved)

- [ ] Place interaction is confusing - "go to [place name]" doesn't work with AI (Could improve)
- [ ] Loading states everywhere - multiple Firebase calls per description (Optimizable later)
- [x] No help system despite mention in system prompt ✅ (Implemented)

## ✨ Recent Improvements (Not in original list)

- [x] Added probability-based interactive element system (70% of places have items/NPCs) ✅
- [x] Improved place generation with explicit LLM requirements ✅
- [x] Better distribution: 28% items, 21% NPCs, 21% both, 30% empty ✅
