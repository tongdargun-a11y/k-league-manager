import type { InboxItem, WorldState } from '../types';

export function addInbox(world: WorldState, item: Omit<InboxItem, 'id' | 'date' | 'read'>): WorldState {
  const entry: InboxItem = {
    ...item,
    id: `inbox-${world.clock.gameDate}-${world.inbox.length + 1}-${Math.abs(hash(item.title)) % 10000}`,
    date: world.clock.gameDate,
    read: false,
  };
  return { ...world, inbox: [entry, ...world.inbox].slice(0, 200) };
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
