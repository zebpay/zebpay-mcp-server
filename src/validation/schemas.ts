/*
  Zod schemas for inputs/outputs. These validate tool params and normalize outputs.
*/

import { z } from "zod";

// Shared enums
export const sideEnum = z.enum(["buy", "sell"]);
export const orderTypeEnum = z.enum(["market", "limit"]);

// Spot
export const spotPlaceOrderInput = z.object({
  symbol: z.string().min(1),
  side: sideEnum,
  type: orderTypeEnum,
  quantity: z.string().min(1),
  price: z.string().optional(),
  clientOrderId: z.string().optional(),
});

export const spotCancelOrderInput = z.object({
  orderId: z.string().min(1),
  symbol: z.string().optional(),
});

export const spotBalancesOutput = z.object({
  balances: z.array(
    z.object({ asset: z.string(), free: z.string(), locked: z.string() })
  ),
});

// Futures
export const futuresPlaceOrderInput = z.object({
  symbol: z.string().min(1),
  side: sideEnum,
  type: orderTypeEnum,
  quantity: z.string().min(1),
  price: z.string().optional(),
  leverage: z.number().int().positive().max(125).optional(),
  clientOrderId: z.string().optional(),
});

export const futuresCancelOrderInput = z.object({
  orderId: z.string().min(1),
  symbol: z.string().optional(),
});

export const futuresPositionsOutput = z.object({
  positions: z.array(
    z.object({
      symbol: z.string(),
      positionSide: z.enum(["long", "short"]).optional(),
      quantity: z.string(),
      entryPrice: z.string().optional(),
      unrealizedPnl: z.string().optional(),
      leverage: z.number().int().positive().optional(),
    })
  ),
});

export type SpotPlaceOrderInput = z.infer<typeof spotPlaceOrderInput>;
export type SpotCancelOrderInput = z.infer<typeof spotCancelOrderInput>;
export type FuturesPlaceOrderInput = z.infer<typeof futuresPlaceOrderInput>;
export type FuturesCancelOrderInput = z.infer<typeof futuresCancelOrderInput>;


