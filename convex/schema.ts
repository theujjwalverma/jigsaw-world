import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    title: v.string(),
    leaderboardSeconds: v.number(),
    rounds: v.array(
      v.object({
        name: v.string(),
        grid: v.number(),
        seconds: v.number(),
        image: v.string(),
      })
    ),
    players: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        avatar: v.string(),
      })
    ),
    createdAt: v.string(),
  }).index("by_code", ["code"]),

  results: defineTable({
    roomCode: v.string(),
    playerId: v.string(),
    round: v.number(),
    moves: v.number(),
    timeMs: v.number(),
    completed: v.boolean(),
    correct: v.number(),
    total: v.number(),
    timedOut: v.boolean(),
    submittedAt: v.string(),
  })
    .index("by_room", ["roomCode"])
    .index("by_room_round", ["roomCode", "round"])
    .index("by_room_player_round", ["roomCode", "playerId", "round"]),
});
