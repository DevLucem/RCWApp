export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type Header = {
  id: number;
  key: string;
  value: string;
  enabled: boolean;
};

export type ApiResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
} | null;

export type ApiError = {
  error: string;
  cause?: any;
} | null;

export type AutomationConfig = {
  sampleData: string;
  headerMappings: Record<string, string>;
  bodyMappings: Record<string, string>;
  disabled?: boolean;
};

export type BodyType = 'none' | 'json' | 'form-data' | 'text';

export type FormDataItem = {
  id: number;
  key: string;
  value: string;
  enabled: boolean;
};

export type RequestTab = {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: Header[];
  bodyType: BodyType;
  requestBody: string;
  formData: FormDataItem[];
  response: ApiResponse;
  apiError: ApiError;
  isLoading: boolean;
  automation?: AutomationConfig;
};

export type HistoryItem = {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: Header[];
  bodyType: BodyType;
  requestBody: string;
  formData: FormDataItem[];
  timestamp: number;
  automation?: AutomationConfig;
};

export type Workspace = {
  id: string;
  name: string;
  createdAt: number;
};

export type WorkspaceData = {
  tabs: RequestTab[];
  activeTabId: string | null;
  history: HistoryItem[];
};
