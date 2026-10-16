import { apiClient } from "./apiClient";
import {
  CharacterResponse,
  CreateCharacterInput,
  UpdateCharacterInput,
} from "@/schemas/characters";

export const characterService = {
  /**
   * Recupera la lista di tutti i personaggi
   */
  async getCharacters(): Promise<CharacterResponse[]> {
    const { data } = await apiClient.get<CharacterResponse[]>("/character");
    return data;
  },

  /**
   * Recupera un singolo personaggio per ID
   */
  async getCharacterById(id: number): Promise<CharacterResponse> {
    const { data } = await apiClient.get<CharacterResponse>(`/character/${id}`);
    return data;
  },

  /**
   * Crea un nuovo personaggio
   */
  async createCharacter(
    payload: CreateCharacterInput
  ): Promise<CharacterResponse> {
    const { data } = await apiClient.post<CharacterResponse>(
      "/character",
      payload
    );
    return data;
  },

  /**
   * Aggiorna un personaggio esistente per ID
   */
  async updateCharacter(
    id: number,
    payload: UpdateCharacterInput
  ): Promise<CharacterResponse> {
    const { data } = await apiClient.put<CharacterResponse>(
      `/character/${id}`,
      payload
    );
    return data;
  },

  /**
   * Elimina un personaggio per ID
   */
  async deleteCharacter(id: number): Promise<{ message: string }> {
    const { data } = await apiClient.delete<{ message: string }>(
      `/character/${id}`
    );
    return data;
  },
};
