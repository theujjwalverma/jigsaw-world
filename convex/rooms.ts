import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("rooms").collect();
  },
});

export const ensureRoom = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      return existing;
    }

    const roomId = await ctx.db.insert("rooms", {
      code: args.code,
      title: args.title,
      leaderboardSeconds: args.leaderboardSeconds,
      rounds: args.rounds,
      players: args.players,
      createdAt: new Date().toISOString(),
    });

    return await ctx.db.get(roomId);
  },
});

export const update = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        leaderboardSeconds: args.leaderboardSeconds,
        rounds: args.rounds,
        players: args.players,
      });
      return await ctx.db.get(existing._id);
    } else {
      const roomId = await ctx.db.insert("rooms", {
        code: args.code,
        title: args.title,
        leaderboardSeconds: args.leaderboardSeconds,
        rounds: args.rounds,
        players: args.players,
        createdAt: new Date().toISOString(),
      });
      return await ctx.db.get(roomId);
    }
  },
});

export const deleteRoom = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const results = await ctx.db
      .query("results")
      .withIndex("by_room", (q) => q.eq("roomCode", args.code))
      .collect();

    for (const res of results) {
      await ctx.db.delete(res._id);
    }

    return { success: true };
  },
});
