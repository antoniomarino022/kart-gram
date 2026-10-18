import { apiClient } from "./apiClient";
import { PaintResponse, CreatePaintInput, UpdatePaintInput } from "@/schemas/paints";

export const paintService = {
  /**
   * Recupera la lista di tutte le vernici
   */
  async getPaints(): Promise<PaintResponse[]> {
    const { data } = await apiClient.get<PaintResponse[]>("/paints");
    return data;
  },

  /**
   * Recupera una singola vernice per ID
   */
  async getPaintById(id: number): Promise<PaintResponse> {
    const { data } = await apiClient.get<PaintResponse>(`/paints/${id}`);
    return data;
  },

  /**
   * Crea una nuova vernice
   */
  async createPaint(payload: CreatePaintInput): Promise<PaintResponse> {
    const { data } = await apiClient.post<PaintResponse>("/paints", payload);
    return data;
  },

  /**
   * Aggiorna una vernice esistente per ID
   */
  async updatePaint(id: number, payload: UpdatePaintInput): Promise<PaintResponse> {
    const { data } = await apiClient.put<PaintResponse>(`/paints/${id}`, payload);
    return data;
  },

  /**
   * Elimina una vernice per ID
   */
  async deletePaint(id: number): Promise<{ message: string }> {
    const { data } = await apiClient.delete<{ message: string }>(`/paints/${id}`);
    return data;
  },
};
