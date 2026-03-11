import { DataSourceType, DataSourceStatus } from '../enums';

export interface ConnectorConfig {
  [key: string]: unknown;
}

export interface ConnectorTestResult {
  success: boolean;
  message: string;
  metadata?: Record<string, unknown>;
  latencyMs?: number;
}

export interface ConnectorResponse {
  id: string;
  name: string;
  type: DataSourceType;
  status: DataSourceStatus;
  lastConnectedAt: string | null;
  assetCount: number;
  createdAt: string;
}

export interface AvailableConnector {
  type: DataSourceType;
  label: string;
  description: string;
  configSchema: Record<string, unknown>;
}
