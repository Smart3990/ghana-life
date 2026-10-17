// Temporary player names until nicknames and accounts arrive (tasks T8 and T13b):
// an Akan day-name plus a number, e.g. "Kofi 27". Check with Ghanaian speakers before launch.
const DAY_NAMES = [
  'Kwasi', 'Akosua', // Sunday
  'Kojo', 'Adwoa', // Monday
  'Kwabena', 'Abena', // Tuesday
  'Kwaku', 'Akua', // Wednesday
  'Yaw', 'Yaa', // Thursday
  'Kofi', 'Afua', // Friday
  'Kwame', 'Ama', // Saturday
];

const KEY = 'gl.name';

export function playerName(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
  } catch {
    // Storage blocked: a new name each visit.
  }
  const name = `${DAY_NAMES[Math.floor(Math.random() * DAY_NAMES.length)]} ${10 + Math.floor(Math.random() * 90)}`;
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // Storage blocked: fine.
  }
  return name;
}
