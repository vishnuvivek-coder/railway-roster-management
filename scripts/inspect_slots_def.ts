import { OCT_2026_MASTER_DAILY_SLOTS, OCT_2026_NON_DAILY_SLOTS } from '../src/frontend/src/App.js';

console.log('Daily slots count:', OCT_2026_MASTER_DAILY_SLOTS.length);
OCT_2026_MASTER_DAILY_SLOTS.forEach((s, i) => {
  console.log(`Slot ${i + 1} (id: ${s.slotId}): ${s.firstTrain}/${s.lastTrain} - ${s.title}`);
  s.links.forEach(l => console.log(`   Cat ${l.categoryId} Link ${l.linkNum} Coach ${l.firstCoach}`));
});
