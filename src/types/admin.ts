import type { z } from "zod";
import type {
  createItemSchema,
  itemFieldsSchema,
  updateItemSchema,
  updatePlayerSchema,
} from "@/schemas/admin";

export type ItemFields = Partial<z.infer<typeof itemFieldsSchema>>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;

export interface ItemRules {
  kind?: string;
  priceCoins?: number | null;
  priceStars?: number | null;
  coins?: number | null;
  revives?: number | null;
  grants?: string[] | null;
}

export interface PlayerItemParamContext {
  params: Promise<{ id: string; itemId: string }>;
}
