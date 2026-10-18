import { apiClient } from "./apiClient";
import { PowerupResponse, CreatePowerupInput, UpdatePowerupInput } from "@/schemas/powerups";

export const powerupService = {
  /**
   * Recupera la lista di tutti i powerup
   */
  async getPowerups(): Promise<PowerupResponse[]> {
    const { data } = await apiClient.get<PowerupResponse[]>("/powerups");
    return data;
  },

  /**
   * Recupera un singolo powerup per ID
   */
  async getPowerupById(id: number): Promise<PowerupResponse> {
    const { data } = await apiClient.get<PowerupResponse>(`/powerups/${id}`);
    return data;
  },

  /**
   * Crea un nuovo powerup
   */
  async createPowerup(payload: CreatePowerupInput): Promise<PowerupResponse> {
    const { data } = await apiClient.post<PowerupResponse>("/powerups", payload);
    return data;
  },

  /**
   * Aggiorna un powerup esistente per ID
   */
  async updatePowerup(id: number, payload: UpdatePowerupInput): Promise<PowerupResponse> {
    const { data } = await apiClient.put<PowerupResponse>(`/powerups/${id}`, payload);
    return data;
  },

  /**
   * Elimina un powerup per ID
   */
  async deletePowerup(id: number): Promise<{ message: string }> {
    const { data } = await apiClient.delete<{ message: string }>(`/powerups/${id}`);
    return data;
  },
};
