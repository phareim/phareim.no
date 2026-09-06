# Another shore

Design brief, 2026-09-06. An original cinematic platformer inspired by the
restrained polygon art and sense of scale of Another World.

An ink-dark coast under a petrol sky. Distant eroded towers, an enormous pale
moon, horizontal bands of water, sharp foreground rock. Flat polygons only;
no neon, gradients, bloom, textures, or borrowed game assets. Palette: sky
#254b59, far rock #356372, middle rock #203d49, ground #101f2a, shadow
#091720, moon #a9b8ac, protagonist shirt #d88b73, trousers #28303e, skin
#ead7b4, signal #e7bb80. The small human silhouette and broad quiet sky are
the composition. Space Grotesk 300 for the person; Space Mono for controls.

The idle view puts the personal profile high on the left, unboxed, with a
thin chapter label and a start button. The lower landscape plays itself.
Starting removes the profile immediately and reveals a sparse progress HUD,
pause/exit controls, and touch buttons. The world remains horizontal on
phones: crop the camera, never rotate the game. Fit 375×667 and landscape.

A short authored journey across three sections: shore, broken causeway,
signal tower. Run left/right and jump across gaps and low rock obstacles.
Three signal beacons are checkpoints, lighting when passed. Falling or
touching hazards respawns at the latest checkpoint. Reach the final signal
to finish. Coyote time and jump buffering soften the deliberate movement.
Attract mode uses the same physics with an autopilot. Reduced motion keeps
the idle landscape still; explicit play still works. No sound required.

Integration contract: types.ts uses world units with y pointing down;
player x/y is feet centre, body 22×52. Ground is around y=420; world height
540. engine.ts exports createWorld(), stepWorld(world,input,dt), and
demoInput(world); renderer.ts exports drawWorld(ctx,world,width,height).
Renderer computes its own camera, always keeps feet/nearby landing visible,
and draws at CSS pixel size (caller applies devicePixelRatio transform).
