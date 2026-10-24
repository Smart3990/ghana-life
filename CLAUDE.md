# Ghanaverse (repository: ghana-life)

The game is now called **Ghanaverse**. "Ghana Life" is the old working title.

## Read first

- `docs/GHANAVERSE_DESIGN_BRIEF.md`: the game design. It wins on design questions (story, missions, screens, look, money, shop).
- `docs/MASTER_PLAN.md`: the engineering rules (zero-dollar start, performance budget, quality tiers, risk register, tasks). It wins on engineering, except where section 22 of the brief changes it.
- `docs/PROGRESS.md`: what is built and tested so far. Update it at the end of every task.

## Rules for every task

- **Performance first, then fun, then realism.** A task is not done until the Light tier stays inside its budget on a cheap Android phone.
- Never name or reference GTA or any other game, anywhere.
- Other Accra games exist (see brief 4.1a). Never copy their map, layout, art or characters. Learn only their 3D smoothness, lighting, animation and phone controls, and use those ideas in our own real-Accra open world.
- No weapons. 18+. Anonymous: nicknames only, never real names, numbers, photos or location.
- All money is decided on the server, with caps.
- Fictional banks, police, gangs and businesses. No real people or brands without permission.
- Use only content that is free to use or our own, and record its source and licence.
- One task at a time. The owner is a beginner: explain in plain words, give exact commands, and wait for confirmation that each step works.
- Every task ends with a "done when" test. Save to Git after every task.
- Keep the rule of three: no more than three big features in progress at once.

## Where things are

- `apps/web`: the browser game (Vite, TypeScript, MapLibre). Live at https://ghana-life-web.ghana-life-web.workers.dev
- `apps/server`: Cloudflare Worker with Durable Objects (live rooms, chat, moderation)
- `scripts`: map, roads and traffic build scripts (see README)
