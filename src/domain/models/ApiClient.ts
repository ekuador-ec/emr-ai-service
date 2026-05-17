export interface ApiClient {
  id: string;
  name: string;
  apiKeyHash: string;
  jwksUrl: string;
  audience: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
