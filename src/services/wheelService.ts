import { apiClient } from "./apiClient";
import { WheelResponse, CreateWheelInput, UpdateWheelInput } from "@/schemas/wheels";

export const wheelService = {
  /**
   * Recupera la lista di tutte le ruote
   */
  async getWheels(): Promise<WheelResponse[]> {
    const { data } = await apiClient.get<WheelResponse[]>("/wheels");
    return data;
  },

  /**
   * Recupera un singolo set di ruote per ID
   */
  async getWheelById(id: number): Promise<WheelResponse> {
    const { data } = await apiClient.get<WheelResponse>(`/wheels/${id}`);
    return data;
  },

  /**
   * Crea nuove ruote
   */
  async createWheel(payload: CreateWheelInput): Promise<WheelResponse> {
    const { data } = await apiClient.post<WheelResponse>("/wheels", payload);
    return data;
  },

  /**
   * Aggiorna ruote esistenti per ID
   */
  async updateWheel(id: number, payload: UpdateWheelInput): Promise<WheelResponse> {
    const { data } = await apiClient.put<WheelResponse>(`/wheels/${id}`, payload);
    return data;
  },

  /**
   * Elimina ruote per ID
   */
  async deleteWheel(id: number): Promise<{ message: string }> {
    const { data } = await apiClient.delete<{ message: string }>(`/wheels/${id}`);
    return data;
  },
};
