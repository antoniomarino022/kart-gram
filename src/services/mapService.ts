import { apiClient } from "./apiClient";
import { CreateMapInput, MapResponse, UpdateMapInput } from "@/schemas/maps";

export const mapService = {
  /**
   * Recupera la lista di tutte le mappe
   */
  async getMaps(): Promise<MapResponse[]> {
    const { data } = await apiClient.get<MapResponse[]>("/maps");
    return data;
  },

  /**
   * Recupera una singola mappa per ID
   */
  async getMapById(id: number): Promise<MapResponse> {
    const { data } = await apiClient.get<MapResponse>(`/maps/${id}`);
    return data;
  },

  /**
   * Crea una nuova mappa
   */
  async createMap(payload: CreateMapInput): Promise<MapResponse> {
    const { data } = await apiClient.post<MapResponse>("/maps", payload);
    return data;
  },

  /**
   * Aggiorna una mappa esistente per ID
   */
  async updateMap(id: number, payload: UpdateMapInput): Promise<MapResponse> {
    const { data } = await apiClient.put<MapResponse>(`/maps/${id}`, payload);
    return data;
  },

  /**
   * Elimina una mappa per ID
   */
  async deleteMap(id: number): Promise<{ message: string }> {
    const { data } = await apiClient.delete<{ message: string }>(`/maps/${id}`);
    return data;
  },
};
