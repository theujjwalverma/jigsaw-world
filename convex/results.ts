import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByRoom = query({
  args: { roomCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("results")
      .withIndex("by_room", (q) => q.eq("roomCode", args.roomCode))
      .collect();
  },
});

export const submit = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    // Check if result already submitted
    const existing = await ctx.db
      .query("results")
      .withIndex("by_room_player_round", (q) =>
        q
          .eq("roomCode", args.roomCode)
          .eq("playerId", args.playerId)
          .eq("round", args.round)
      )
      .first();

    if (existing) {
      return existing;
    }

    const id = await ctx.db.insert("results", {
      roomCode: args.roomCode,
      playerId: args.playerId,
      round: args.round,
      moves: args.moves,
      timeMs: args.timeMs,
      completed: args.completed,
      correct: args.correct,
      total: args.total,
      timedOut: args.timedOut,
      submittedAt: args.submittedAt,
    });

    return await ctx.db.get(id);
  },
});

export const resetRoom = mutation({
  args: { roomCode: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("results")
      .withIndex("by_room", (q) => q.eq("roomCode", args.roomCode))
      .collect();

    for (const res of existing) {
      await ctx.db.delete(res._id);
    }

    return { deleted: existing.length };
  },
});
