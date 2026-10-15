/* Hardcoded defaults: classic script, not fetch(), so double-click/file:// works. */
window.OFFLINE_GALLERY = [
  { name: "Picture 1", image: "assets/rounds/1 7.png" },
  { name: "Picture 2", image: "assets/rounds/2 6.png" },
  { name: "Picture 3", image: "assets/rounds/3 5.png" },
  { name: "Picture 4", image: "assets/rounds/4 3.png" },
  { name: "Picture 5", image: "assets/rounds/5 2.png" }
];
window.OFFLINE_DEFAULTS = {
  schemaVersion: 1,
  roomCode: "",
  title: "Jigsaw Arena",
  leaderboardSeconds: 30,
  players: window.OFFLINE_AVATARS,
  rounds: [
    { name: "A little sunshine", grid: 2, seconds: 180, image: "assets/rounds/round-1.svg" },
    { name: "Mountain daydream", grid: 3, seconds: 240, image: "assets/rounds/round-2.svg" },
    { name: "Coastal calm", grid: 4, seconds: 300, image: "assets/rounds/round-3.svg" },
    { name: "Bloom & grow", grid: 5, seconds: 360, image: "assets/rounds/round-4.svg" },
    { name: "Under the stars", grid: 6, seconds: 420, image: "assets/rounds/round-5.svg" }
  ]
};