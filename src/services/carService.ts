import { apiClient } from "./apiClient";
import { CarResponse, CreateCarInput, UpdateCarInput } from "@/schemas/cars";

export const carService = {
  /**
   * Recupera la lista di tutte le auto
   */
  async getCars(): Promise<CarResponse[]> {
    const { data } = await apiClient.get<CarResponse[]>("/car");
    return data;
  },

  /**
   * Recupera una singola auto per ID
   */
  async getCarById(id: number): Promise<CarResponse> {
    const { data } = await apiClient.get<CarResponse>(`/car/${id}`);
    return data;
  },

  /**
   * Crea una nuova auto
   */
  async createCar(payload: CreateCarInput): Promise<CarResponse> {
    const { data } = await apiClient.post<CarResponse>("/car", payload);
    return data;
  },

  /**
   * Aggiorna un'auto esistente per ID
   */
  async updateCar(id: number, payload: UpdateCarInput): Promise<CarResponse> {
    const { data } = await apiClient.put<CarResponse>(`/car/${id}`, payload);
    return data;
  },

  /**
   * Elimina un'auto per ID
   */
  async deleteCar(id: number): Promise<{ message: string }> {
    const { data } = await apiClient.delete<{ message: string }>(`/car/${id}`);
    return data;
  },
};
