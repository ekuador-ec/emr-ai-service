import type { ApiClient } from "../models/ApiClient.js";

export interface ApiClientRepository {
  findActiveById(id: string): Promise<ApiClient | null>;
  listActive(): Promise<ApiClient[]>;
}
