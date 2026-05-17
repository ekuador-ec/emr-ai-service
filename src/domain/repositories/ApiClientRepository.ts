import type { ApiClient } from "../models/ApiClient.js";

export interface ApiClientRepository {
  findActiveById(id: string): Promise<ApiClient | null>;
  findActiveByPrefix(prefix: string): Promise<ApiClient | null>;
}
