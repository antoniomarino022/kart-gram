import { apiClient } from "./apiClient";
import { TelegramUserProfileResponse } from "@/schemas/telegramUsers";
import { getInitData } from "@/telegram/webapp";

export const userService = {
  /**
   * Recupera il profilo completo dell'utente (per userId, telegramId o tramite initData di Telegram)
   */
  async getUserProfile(params?: {
    userId?: number;
    telegramId?: number;
  }): Promise<TelegramUserProfileResponse> {
    const initData = getInitData();
    const { data } = await apiClient.get<TelegramUserProfileResponse>("/user", {
      params,
      headers: initData ? { Authorization: `tma ${initData}` } : undefined,
    });
    return data;
  },
};
