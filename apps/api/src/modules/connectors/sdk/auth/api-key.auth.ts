export interface ApiKeyConfig {
  key: string;
  headerName?: string;
  prefix?: string;
}

export class ApiKeyAuth {
  constructor(private config: ApiKeyConfig) {}

  getHeaders(): Record<string, string> {
    const headerName = this.config.headerName || 'Authorization';
    const prefix = this.config.prefix || 'Bearer';
    return { [headerName]: `${prefix} ${this.config.key}` };
  }
}
