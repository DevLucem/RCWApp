'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Rocket,
  Send,
  Plus,
  Trash2,
  Loader2,
  ServerCrash,
  History,
  Search,
  X,
  Edit,
  Download,
  Import,
  ChevronDown,
  Zap,
  Copy,
  Play,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { sendApiRequest } from './actions';
import { parseCurl, isCurlCommand } from '@/lib/parse-curl';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarInset,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { formatHistoryDate } from '@/lib/date-utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  type HttpMethod,
  type Header,
  type ApiResponse,
  type ApiError,
  type RequestTab,
  type HistoryItem,
  type Workspace,
  type WorkspaceData,
  type AutomationConfig,
  type BodyType,
} from './types';
import { ThemeToggle } from '@/components/theme-toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const createNewTab = (): RequestTab => ({
  id: doc(collection(db, 'temp')).id,
  name: '',
  method: 'GET',
  url: '',
  headers: [],
  bodyType: 'none',
  requestBody: '',
  formData: [],
  response: null,
  apiError: null,
  isLoading: false,
  automation: undefined,
});

const createNewWorkspace = (name: string): Workspace => ({
  id: doc(collection(db, 'temp')).id,
  name,
  createdAt: Date.now(),
});

export default function Home() {
  // Global state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  // Workspace-specific state
  const [tabs, setTabs] = useState<RequestTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogState, setDialogState] = useState<{
    type: 'create' | 'rename' | 'delete' | null;
    workspace?: Workspace;
  }>({ type: null });
  const [workspaceNameInput, setWorkspaceNameInput] = useState('');
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const historyFileInputRef = useRef<HTMLInputElement>(null);
  const workspaceFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [requestTab, setRequestTab] = useState('headers');
  const [responseTab, setResponseTab] = useState('body');
  const [isAutomateDialogOpen, setAutomateDialogOpen] = useState(false);
  const [automationConfig, setAutomationConfig] = useState<AutomationConfig | undefined>(undefined);
  const [parsedSampleData, setParsedSampleData] = useState<any>(null);
  const [isSavingAutomation, setIsSavingAutomation] = useState(false);
  const [tabToDeleteId, setTabToDeleteId] = useState<string | null>(null);


  const activeWorkspace = useMemo(() => workspaces.find(w => w.id === activeWorkspaceId), [workspaces, activeWorkspaceId]);
  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId), [tabs, activeTabId]);

  const isHtmlResponse = useMemo(() => {
    if (!activeTab?.response?.headers) return false;
    const contentType = activeTab.response.headers['content-type'] || '';
    return contentType.includes('text/html');
  }, [activeTab?.response]);

  const prettyBody = useMemo(() => {
    if (!activeTab?.response?.data) return '';
    try {
      const { data, headers } = activeTab.response;
      const contentType = headers['content-type'] || '';

      if (typeof data === 'object') {
        return JSON.stringify(data, null, 2);
      }

      if (contentType.includes('application/json') && typeof data === 'string') {
        return JSON.stringify(JSON.parse(data), null, 2);
      }

      return String(data);
    } catch (e) {
      return String(activeTab?.response?.data || '');
    }
  }, [activeTab?.response]);

  const rawBody = useMemo(() => {
    if (!activeTab?.response?.data) return '';
    const data = activeTab.response.data;
    if (typeof data === 'object') {
      return JSON.stringify(data);
    }
    return String(data);
  }, [activeTab?.response]);

  const isAutomationActive = useMemo(() => {
    if (!activeTab?.automation) return false;
    // Automation is considered active if there's sample data and any mappings, and it's not disabled.
    const { headerMappings, bodyMappings, sampleData, disabled } = activeTab.automation;
    return (
      !disabled &&
      (Object.keys(headerMappings).length > 0 ||
        Object.keys(bodyMappings).length > 0) &&
      sampleData.trim() !== ''
    );
  }, [activeTab?.automation]);

  // Data loading & migration effect
  useEffect(() => {
    try {
      const savedWorkspaces = window.localStorage.getItem('request-call-workspaces');

      if (savedWorkspaces) {
        // New workspace system exists, load it
        const parsedWorkspaces = JSON.parse(savedWorkspaces) as Workspace[];
        setWorkspaces(parsedWorkspaces);

        const savedActiveId = window.localStorage.getItem('request-call-activeWorkspaceId');
        if (savedActiveId && parsedWorkspaces.some(w => w.id === savedActiveId)) {
          setActiveWorkspaceId(savedActiveId);
        } else {
          setActiveWorkspaceId(parsedWorkspaces[0]?.id || null);
        }
      } else {
        // No workspaces found, perform migration from old system
        const defaultWorkspace = createNewWorkspace('Default Workspace');
        const oldTabs = window.localStorage.getItem('request-call-tabs');
        const oldActiveTabId = window.localStorage.getItem('request-call-activeTabId');
        const oldHistory = window.localStorage.getItem('request-call-history');

        const migratedTabs = oldTabs ? JSON.parse(oldTabs).map(t => ({
          ...createNewTab(),
          ...t,
          bodyType: t.bodyType || (t.requestBody ? 'json' : 'none'),
        })) : [createNewTab()];

        const migratedHistory = oldHistory ? JSON.parse(oldHistory).map(h => ({
          ...h,
          bodyType: h.bodyType || (h.requestBody ? 'json' : 'none'),
          formData: h.formData || [],
        })) : [];

        const migratedData: WorkspaceData = {
          tabs: migratedTabs,
          activeTabId: oldActiveTabId ? JSON.parse(oldActiveTabId) : null,
          history: migratedHistory,
        };

        if (!migratedData.activeTabId && migratedData.tabs.length > 0) {
          migratedData.activeTabId = migratedData.tabs[0].id;
        }

        const allData = { [defaultWorkspace.id]: migratedData };

        window.localStorage.setItem('request-call-workspaces', JSON.stringify([defaultWorkspace]));
        window.localStorage.setItem('request-call-activeWorkspaceId', defaultWorkspace.id);
        window.localStorage.setItem('request-call-data', JSON.stringify(allData));

        // Clean up old keys
        window.localStorage.removeItem('request-call-tabs');
        window.localStorage.removeItem('request-call-activeTabId');
        window.localStorage.removeItem('request-call-history');

        setWorkspaces([defaultWorkspace]);
        setActiveWorkspaceId(defaultWorkspace.id);
      }
    } catch (e) {
      console.error('Failed to initialize from local storage', e);
      // Fallback to a clean slate
      const firstWorkspace = createNewWorkspace('Default Workspace');
      setWorkspaces([firstWorkspace]);
      setActiveWorkspaceId(firstWorkspace.id);
    }
  }, []);

  // Load data for the active workspace
  useEffect(() => {
    if (!activeWorkspaceId) return;

    try {
      const allDataStr = window.localStorage.getItem('request-call-data');
      const allData = allDataStr ? JSON.parse(allDataStr) : {};
      const workspaceData = allData[activeWorkspaceId];

      if (workspaceData) {
        const loadedTabs = (workspaceData.tabs || [createNewTab()]).map(tab => ({
          ...createNewTab(), // Ensure all defaults are present
          ...tab, // Overwrite with saved data
          bodyType: tab.bodyType || (tab.requestBody ? 'json' : 'none'),
          formData: tab.formData || [],
        }));

        const loadedHistory = (workspaceData.history || []).map(item => ({
          ...item, // Assuming history items are complete, but good to be safe
          bodyType: item.bodyType || (item.requestBody ? 'json' : 'none'),
          formData: item.formData || [],
        }));

        setTabs(loadedTabs);
        setActiveTabId(workspaceData.activeTabId || (loadedTabs.length > 0 ? loadedTabs[0].id : null));
        setHistory(loadedHistory);
      } else {
        // First time this workspace is active, initialize it
        const firstTab = createNewTab();
        setTabs([firstTab]);
        setActiveTabId(firstTab.id);
        setHistory([]);
      }
    } catch (e) {
      console.error(`Failed to load data for workspace ${activeWorkspaceId}`, e);
    }
  }, [activeWorkspaceId]);

  // Save data for the active workspace
  useEffect(() => {
    if (!activeWorkspaceId || tabs.length === 0) return;

    try {
      const allDataStr = window.localStorage.getItem('request-call-data');
      const allData = allDataStr ? JSON.parse(allDataStr) : {};

      const tabsToSave = tabs.map(tab => ({ ...tab, isLoading: false }));

      const workspaceData: WorkspaceData = {
        tabs: tabsToSave,
        activeTabId,
        history,
      };

      allData[activeWorkspaceId] = workspaceData;
      window.localStorage.setItem('request-call-data', JSON.stringify(allData));

    } catch (e) {
      console.error(`Failed to save data for workspace ${activeWorkspaceId}`, e);
    }
  }, [tabs, activeTabId, history, activeWorkspaceId]);

  // Save workspaces list and active ID
  useEffect(() => {
    if (workspaces.length > 0 && activeWorkspaceId) {
      try {
        window.localStorage.setItem('request-call-workspaces', JSON.stringify(workspaces));
        window.localStorage.setItem('request-call-activeWorkspaceId', activeWorkspaceId);
      } catch (e) {
        console.error('Could not save workspace metadata to local storage', e);
      }
    }
  }, [workspaces, activeWorkspaceId]);

  // Sync automation dialog state with active tab
  useEffect(() => {
    if (isAutomateDialogOpen && activeTab) {
      const currentAutomation = activeTab.automation || { sampleData: '', headerMappings: {}, bodyMappings: {} };
      setAutomationConfig({
        ...currentAutomation,
        disabled: currentAutomation.disabled ?? true, // Default to disabled
      });
    } else {
      setAutomationConfig(undefined);
    }
  }, [isAutomateDialogOpen, activeTab]);

  useEffect(() => {
    if (automationConfig?.sampleData) {
      try {
        const parsed = JSON.parse(automationConfig.sampleData);
        setParsedSampleData(parsed);
      } catch (e) {
        setParsedSampleData(null); // Invalid JSON
      }
    } else {
      setParsedSampleData(null);
    }
  }, [automationConfig?.sampleData]);

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) {
      return history;
    }
    const searchTerms = searchTerm.toLowerCase().split(' ').filter(Boolean);
    return history.filter(item => {
      const searchableContent = `${item.name} ${item.method} ${item.url} ${item.requestBody}`.toLowerCase();
      return searchTerms.every(term => searchableContent.includes(term));
    });
  }, [history, searchTerm]);

  const groupedHistory = useMemo(() => {
    return filteredHistory.reduce((acc, item) => {
      const date = new Date(item.timestamp);
      const groupTitle = formatHistoryDate(date);
      if (!acc[groupTitle]) {
        acc[groupTitle] = [];
      }
      acc[groupTitle].push(item);
      return acc;
    }, {} as Record<string, HistoryItem[]>);
  }, [filteredHistory]);

  const addTab = () => {
    const newTab = createNewTab();
    setTabs(prevTabs => [newTab, ...prevTabs]);
    setActiveTabId(newTab.id);
  };

  const removeTab = async (tabIdToRemove: string) => {
    try {
      await deleteDoc(doc(db, 'rcwapp', 'data', 'webhooks', tabIdToRemove));
    } catch (e) {
      console.error('Failed to clear webhook for closed tab', e);
    }

    const tabIndex = tabs.findIndex(tab => tab.id === tabIdToRemove);
    if (tabIndex === -1) return;

    let newActiveTabId = activeTabId;
    if (tabIdToRemove === activeTabId) {
      if (tabs.length > 1) {
        if (tabIndex === 0) {
          newActiveTabId = tabs[1].id;
        } else {
          newActiveTabId = tabs[tabIndex - 1].id;
        }
      } else {
        newActiveTabId = null;
      }
    }

    const newTabs = tabs.filter(tab => tab.id !== tabIdToRemove);

    setTabs(newTabs);
    setActiveTabId(newActiveTabId);

    if (newTabs.length === 0) {
      addTab();
    }
  };

  const handleCloseTabRequest = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.automation && !tab.automation.disabled) {
      setTabToDeleteId(tabId);
    } else {
      removeTab(tabId);
    }
  };

  const updateActiveTab = (updates: Partial<Omit<RequestTab, 'id'>>) => {
    if (!activeTabId) return;
    setTabs(tabs.map(tab =>
      tab.id === activeTabId ? { ...tab, ...updates } : tab
    ));
  };

  const handleUrlChange = (value: string) => {
    if (isCurlCommand(value)) {
      const parsed = parseCurl(value);
      if (parsed) {
        const newHeaders = parsed.headers.map((h, i) => ({
          id: Date.now() + i,
          key: h.key,
          value: h.value,
          enabled: true,
        }));
        updateActiveTab({
          url: parsed.url,
          method: parsed.method as any,
          headers: newHeaders,
          requestBody: parsed.body,
          bodyType: parsed.bodyType,
        });
        if (parsed.body) setRequestTab('body');
        toast({
          title: 'cURL imported',
          description: `Extracted ${parsed.method} request with ${newHeaders.length} header${newHeaders.length !== 1 ? 's' : ''}.`,
        });
        return;
      }
    }
    updateActiveTab({ url: value });
  };

  const handleAddHeader = () => {
    if (!activeTab) return;
    updateActiveTab({ headers: [...activeTab.headers, { id: Date.now(), key: '', value: '', enabled: true }] });
  };

  const handleHeaderChange = (id: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    if (!activeTab) return;
    const newHeaders = activeTab.headers.map(header =>
      header.id === id ? { ...header, [field]: value } : header
    );
    updateActiveTab({ headers: newHeaders });
  };

  const handleRemoveHeader = (id: number) => {
    if (!activeTab) return;
    updateActiveTab({ headers: activeTab.headers.filter(h => h.id !== id) });
  };

  const handleAddFormData = () => {
    if (!activeTab) return;
    updateActiveTab({ formData: [...activeTab.formData, { id: Date.now(), key: '', value: '', enabled: true }] });
  };

  const handleFormDataChange = (id: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    if (!activeTab) return;
    const newFormData = activeTab.formData.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    );
    updateActiveTab({ formData: newFormData });
  };

  const handleRemoveFormData = (id: number) => {
    if (!activeTab) return;
    updateActiveTab({ formData: activeTab.formData.filter(item => item.id !== id) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTab || !activeTab.url) {
      toast({
        variant: 'destructive',
        title: 'URL is required',
        description: 'Please enter an API endpoint URL to send a request.',
      });
      return;
    }

    updateActiveTab({ isLoading: true, response: null, apiError: null });

    let requestBody: string | undefined = undefined;
    const finalHeaders = activeTab.headers
      .filter((h) => h.enabled && h.key)
      .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {} as Record<string, string>);

    const hasContentType = Object.keys(finalHeaders).some(k => k.toLowerCase() === 'content-type');

    if (activeTab.bodyType === 'json') {
      requestBody = activeTab.requestBody;
      if (!hasContentType && activeTab.requestBody) {
        finalHeaders['Content-Type'] = 'application/json';
      }
    } else if (activeTab.bodyType === 'text') {
      requestBody = activeTab.requestBody;
      if (!hasContentType && activeTab.requestBody) {
        finalHeaders['Content-Type'] = 'text/plain';
      }
    } else if (activeTab.bodyType === 'form-data') {
      const activeFormData = activeTab.formData.filter(item => item.enabled && item.key);
      if (activeFormData.length > 0) {
        const formData = new URLSearchParams();
        activeFormData.forEach(item => formData.append(item.key, item.value));
        requestBody = formData.toString();
        if (!hasContentType) {
          finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }
    }

    const timestamp = Date.now();
    const newHistoryItem: HistoryItem = {
      id: doc(collection(db, 'temp')).id,
      name: activeTab.name,
      method: activeTab.method,
      url: activeTab.url,
      headers: activeTab.headers,
      bodyType: activeTab.bodyType,
      requestBody: activeTab.requestBody,
      formData: activeTab.formData,
      automation: activeTab.automation,
      timestamp,
    };

    setHistory(prevHistory => [newHistoryItem, ...prevHistory].slice(0, 50));

    const result = await sendApiRequest(activeTab.url, {
      method: activeTab.method,
      headers: finalHeaders,
      body: requestBody,
    });

    if (result.ok) {
      updateActiveTab({ response: result, isLoading: false });
    } else {
      updateActiveTab({ apiError: result, isLoading: false });
      toast({
        variant: 'destructive',
        title: 'Request Failed',
        description: result.error,
      });
    }
  };

  const getStatusBadgeVariant = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-primary/20 text-primary border-primary/30';
    if (status >= 300 && status < 400) return 'bg-attention/20 text-attention border-attention/30';
    if (status >= 400 && status < 500) return 'bg-warning/20 text-warning border-warning/30';
    if (status >= 500) return 'bg-destructive/20 text-destructive border-destructive/30';
    return 'secondary';
  };

  const getMethodBadgeVariant = (method: HttpMethod) => {
    switch (method) {
      case 'GET': return 'border-primary/50 text-primary';
      case 'POST': return 'border-warning/50 text-warning';
      case 'PUT': return 'border-info/50 text-info';
      case 'PATCH': return 'border-attention/50 text-attention';
      case 'DELETE': return 'border-destructive/50 text-destructive';
      default: return 'border-muted-foreground/50 text-muted-foreground';
    }
  };

  const getMethodSelectVariant = (method: HttpMethod) => {
    switch (method) {
      case 'GET': return 'bg-primary/20 border-primary/30 text-primary';
      case 'POST': return 'bg-warning/20 border-warning/30 text-warning';
      case 'PUT': return 'bg-info/20 border-info/30 text-info';
      case 'PATCH': return 'bg-attention/20 border-attention/30 text-attention';
      case 'DELETE': return 'bg-destructive/20 border-destructive/30 text-destructive';
      default: return 'bg-muted/20 border-muted-foreground/30 text-muted-foreground';
    }
  };

  const getMethodDotColor = (method: HttpMethod) => {
    switch (method) {
      case 'GET': return 'bg-primary';
      case 'POST': return 'bg-warning';
      case 'PUT': return 'bg-info';
      case 'PATCH': return 'bg-attention';
      case 'DELETE': return 'bg-destructive';
      default: return 'bg-muted-foreground';
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
    const newTab: RequestTab = {
      id: doc(collection(db, 'temp')).id,
      name: item.name,
      method: item.method,
      url: item.url,
      headers: item.headers,
      bodyType: item.bodyType || 'none',
      requestBody: item.requestBody,
      formData: item.formData || [],
      response: null,
      apiError: null,
      isLoading: false,
      automation: item.automation,
    };
    setTabs(prevTabs => [newTab, ...prevTabs]);
    setActiveTabId(newTab.id);
  };

  const clearHistory = () => {
    setHistory([]);
  };

  // --- Workspace Management ---
  const handleSwitchWorkspace = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
  };

  const closeDialogs = () => {
    setDialogState({ type: null });
    setWorkspaceNameInput('');
  }

  const handleOpenDialog = (type: 'create' | 'rename' | 'delete', workspace?: Workspace) => {
    setDialogState({ type, workspace });
    if (type === 'rename' && workspace) {
      setWorkspaceNameInput(workspace.name);
    } else {
      setWorkspaceNameInput('');
    }
  };

  const handleDialogSubmit = () => {
    if (dialogState.type === 'create') {
      if (workspaceNameInput.trim()) {
        const newWorkspace = createNewWorkspace(workspaceNameInput.trim());
        setWorkspaces(prev => [...prev, newWorkspace]);
        setActiveWorkspaceId(newWorkspace.id);
      }
    } else if (dialogState.type === 'rename' && dialogState.workspace) {
      if (workspaceNameInput.trim()) {
        setWorkspaces(prev => prev.map(w =>
          w.id === dialogState.workspace!.id ? { ...w, name: workspaceNameInput.trim() } : w
        ));
      }
    }
    closeDialogs();
  };

  const handleDeleteWorkspace = () => {
    if (dialogState.type !== 'delete' || !dialogState.workspace) return;
    const workspaceToDeleteId = dialogState.workspace.id;

    // Remove workspace and its data
    setWorkspaces(prev => prev.filter(w => w.id !== workspaceToDeleteId));
    try {
      const allDataStr = window.localStorage.getItem('request-call-data');
      if (allDataStr) {
        const allData = JSON.parse(allDataStr);
        delete allData[workspaceToDeleteId];
        window.localStorage.setItem('request-call-data', JSON.stringify(allData));
      }
    } catch (e) {
      console.error(`Failed to delete data for workspace ${workspaceToDeleteId}`, e);
    }

    // Switch to another workspace if the active one was deleted
    if (activeWorkspaceId === workspaceToDeleteId) {
      const remainingWorkspaces = workspaces.filter(w => w.id !== workspaceToDeleteId);
      if (remainingWorkspaces.length > 0) {
        setActiveWorkspaceId(remainingWorkspaces[0].id);
      } else {
        // If no workspaces left, create a new default one
        const newDefault = createNewWorkspace('Default Workspace');
        setWorkspaces([newDefault]);
        setActiveWorkspaceId(newDefault.id);
      }
    }

    closeDialogs();
  };

  useEffect(() => {
    if (dialogState.type === 'create' || dialogState.type === 'rename') {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [dialogState.type]);

  const handleExportHistory = () => {
    if (!activeWorkspace || history.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nothing to export',
        description: 'There is no history in the current workspace to export.',
      });
      return;
    }

    const dataStr = JSON.stringify(history, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const workspaceName = activeWorkspace.name.replace(/\s+/g, '-').toLowerCase();
    link.download = `request-call-history-${workspaceName}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'History Exported',
      description: `Your request history for '${activeWorkspace.name}' has been downloaded.`,
    });
  };

  const handleExportWorkspace = () => {
    if (!activeWorkspace) {
      toast({
        variant: 'destructive',
        title: 'No active workspace',
        description: 'Please select a workspace to export.',
      });
      return;
    }

    try {
      const allDataStr = window.localStorage.getItem('request-call-data');
      if (!allDataStr) {
        throw new Error('No workspace data found in storage.');
      }
      const allData = JSON.parse(allDataStr);
      const workspaceData = allData[activeWorkspace.id];

      if (!workspaceData) {
        throw new Error(`No data found for workspace '${activeWorkspace.name}'.`);
      }

      const exportObject = {
        type: "RequestCall-Workspace-Export-v1",
        workspace: activeWorkspace,
        data: workspaceData,
      };

      const dataStr = JSON.stringify(exportObject, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const workspaceName = activeWorkspace.name.replace(/\s+/g, '-').toLowerCase();
      link.download = `request-call-workspace-${workspaceName}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Workspace Exported',
        description: `Your workspace '${activeWorkspace.name}' has been downloaded.`,
      });

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: error.message || 'Could not export the workspace.',
      });
    }
  };

  const handleHistoryImportClick = () => {
    historyFileInputRef.current?.click();
  };

  const handleHistoryFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error('File content is not readable');
        }
        const importedHistory: HistoryItem[] = JSON.parse(text);

        if (!Array.isArray(importedHistory) || importedHistory.some(item => !item.id || !item.method || !item.url || !item.timestamp)) {
          throw new Error('Invalid history file format.');
        }

        const combinedHistory = [...importedHistory, ...history];
        const uniqueHistory = Array.from(new Map(combinedHistory.map(item => [item.id, item])).values());

        uniqueHistory.sort((a, b) => b.timestamp - a.timestamp);

        setHistory(uniqueHistory.slice(0, 50));

        toast({
          title: 'Import Successful',
          description: `Successfully imported and merged ${importedHistory.length} history items.`,
        });

      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: error.message || 'Could not parse the history file.',
        });
      } finally {
        if (event.target) {
          event.target.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleWorkspaceImportClick = () => {
    workspaceFileInputRef.current?.click();
  };

  const handleWorkspaceFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error('File content is not readable');
        }
        const imported = JSON.parse(text);

        // Validation
        if (imported.type !== 'RequestCall-Workspace-Export-v1' || !imported.workspace || !imported.data) {
          throw new Error('Invalid workspace file format.');
        }

        const newWorkspace: Workspace = imported.workspace;
        const newWorkspaceData: WorkspaceData = imported.data;

        if (workspaces.some(w => w.id === newWorkspace.id)) {
          toast({
            variant: 'destructive',
            title: 'Import Failed',
            description: `A workspace with the ID '${newWorkspace.id}' already exists.`,
          });
          return;
        }

        // Add to workspaces state
        setWorkspaces(prev => [...prev, newWorkspace]);

        // Add to data in local storage
        const allDataStr = window.localStorage.getItem('request-call-data');
        const allData = allDataStr ? JSON.parse(allDataStr) : {};
        allData[newWorkspace.id] = newWorkspaceData;
        window.localStorage.setItem('request-call-data', JSON.stringify(allData));

        // Switch to the new workspace
        setActiveWorkspaceId(newWorkspace.id);

        toast({
          title: 'Import Successful',
          description: `Successfully imported workspace '${newWorkspace.name}'.`,
        });

      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: error.message || 'Could not parse the workspace file.',
        });
      } finally {
        if (event.target) {
          event.target.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  // --- Automation Dialog Helpers ---
  const JsonTreeView = ({ data, pathPrefix = '' }: { data: any, pathPrefix?: string }) => {
    if (data === null || typeof data !== 'object') {
      return null;
    }

    const handleDragStart = (e: React.DragEvent<HTMLElement>, path: string) => {
      e.dataTransfer.setData('text/plain', path);
      e.dataTransfer.effectAllowed = 'copy';
    };

    return (
      <ul className="space-y-1 font-code text-sm">
        {Object.entries(data).map(([key, value]) => {
          const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
          const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);

          return (
            <li key={currentPath} className="ml-4 pl-2 border-l border-muted">
              <strong
                className="cursor-grab hover:bg-muted rounded px-1"
                draggable
                onDragStart={(e) => handleDragStart(e, currentPath)}
              >
                {key}
              </strong>
              {isObject ? (
                <JsonTreeView data={value} pathPrefix={currentPath} />
              ) : (
                <span className="text-muted-foreground">: {Array.isArray(value) ? ' [...]' : JSON.stringify(value)}</span>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  const getRequestBodyKeys = () => {
    if (!activeTab?.requestBody) return [];
    try {
      const body = JSON.parse(activeTab.requestBody);
      if (typeof body !== 'object' || body === null || Array.isArray(body)) return [];
      return Object.keys(body);
    } catch {
      return [];
    }
  };

  const handleHeaderMappingChange = (key: string, value: string) => {
    setAutomationConfig(prev => {
      if (!prev) return undefined;
      return {
        ...prev,
        headerMappings: {
          ...prev.headerMappings,
          [key]: value,
        },
      };
    });
  };

  const handleBodyMappingChange = (key: string, value: string) => {
    setAutomationConfig(prev => {
      if (!prev) return undefined;
      return {
        ...prev,
        bodyMappings: {
          ...prev.bodyMappings,
          [key]: value,
        },
      };
    });
  };

  const handleSaveAutomation = async () => {
    if (automationConfig && activeTab) {
      updateActiveTab({ automation: automationConfig });
      setIsSavingAutomation(true);
      try {
        const docRef = doc(db, 'rcwapp', 'data', 'webhooks', activeTab.id);
        if (!automationConfig.disabled) {
          await setDoc(docRef, {
            id: activeTab.id,
            name: activeTab.name || 'Unnamed Request',
            url: activeTab.url,
            method: activeTab.method,
            headers: activeTab.headers,
            bodyType: activeTab.bodyType,
            requestBody: activeTab.requestBody,
            formData: activeTab.formData,
            automation: automationConfig,
            updatedAt: Date.now()
          }, { merge: true });
          toast({ title: "Automation saved to Firestore database." });
        } else {
          await deleteDoc(docRef);
          toast({ title: "Automation configuration saved." });
        }
      } catch (error: any) {
        console.error("Firebase error", error);
        toast({ variant: 'destructive', title: "Database error", description: error.message });
      } finally {
        setIsSavingAutomation(false);
        setAutomateDialogOpen(false);
      }
    } else {
      setAutomateDialogOpen(false);
    }
  };

  const handleToggleAutomationStatus = async () => {
    if (!automationConfig || !activeTab) return;
    const newConfig = { ...automationConfig, disabled: !automationConfig.disabled };
    setAutomationConfig(newConfig);
    updateActiveTab({ automation: newConfig });

    toast({
      title: 'Automation Updated',
      description: `Automation has been ${newConfig.disabled ? 'disabled' : 'enabled'}.`,
    });
  };


  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-2 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="hidden md:flex" />
            <div className="relative flex-1 group-data-[state=collapsed]:hidden">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Filter history..."
                className="w-full rounded-lg bg-muted pl-8 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {filteredHistory.length > 0 ? (
            <ScrollArea className="h-full">
              {Object.keys(groupedHistory).map((date) => (
                <SidebarGroup key={date} className="p-2 pt-0">
                  <SidebarGroupLabel className="px-0 pt-2">{date}</SidebarGroupLabel>
                  <SidebarMenu>
                    {groupedHistory[date].map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          variant="outline"
                          onClick={() => loadFromHistory(item)}
                          className="h-auto w-full justify-start group-data-[collapsible=icon]:justify-center py-2"
                          tooltip={item.name || item.url}
                        >
                          <div className="flex w-full items-center gap-2 group-data-[collapsible=icon]:hidden">
                            <Badge variant="outline" className={cn('w-20 justify-center font-bold', getMethodBadgeVariant(item.method))}>
                              {item.method}
                            </Badge>
                            <p className="truncate text-sm font-normal text-muted-foreground flex-1 text-left">{item.name || item.url}</p>
                          </div>
                          <div className="hidden w-full items-center justify-center group-data-[collapsible=icon]:flex">
                            <span className={cn('h-2.5 w-2.5 rounded-full', getMethodDotColor(item.method))} />
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
              ))}
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
              <History className="w-10 h-10 mb-4" />
              <p className="font-semibold">{searchTerm ? "No Results" : "No History"}</p>
              <p className="text-sm">
                {searchTerm
                  ? "Your search did not match any requests."
                  : "Your API request history will show up here."}
              </p>
            </div>
          )}
        </SidebarContent>
        <SidebarFooter>
          <div className="flex justify-center gap-1 p-2 border-t group-data-[collapsible=icon]:hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setShowClearHistoryDialog(true)} disabled={history.length === 0}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Clear History</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleExportHistory} disabled={history.length === 0}>
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Export History</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleHistoryImportClick}>
                  <Import className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Import History</p></TooltipContent>
            </Tooltip>
          </div>
          <div className="p-2 group-data-[collapsible=icon]:hidden">
            <ThemeToggle />
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className='flex flex-col h-screen'>

          <header className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="md:hidden" />
              <Rocket className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold font-headline tracking-tighter">RCWApp</h1>
                <p className="text-muted-foreground text-sm">A simple, fast, and elegant REST API testing tool.</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <span>{activeWorkspace?.name || 'Select Workspace'}</span>
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="end">
                <DropdownMenuGroup>
                  {workspaces.map(ws => (
                    <DropdownMenuItem key={ws.id} onSelect={() => handleSwitchWorkspace(ws.id)} className="flex justify-between items-center">
                      <span>{ws.name}</span>
                      {ws.id === activeWorkspaceId && <span className={cn('w-2 h-2 rounded-full', 'bg-primary')} />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => handleOpenDialog('create')}>
                  <Plus className="mr-2" />
                  <span>Create Workspace</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleWorkspaceImportClick}>
                  <Import className="mr-2" />
                  <span>Import Workspace</span>
                </DropdownMenuItem>
                {workspaces.length > 0 && activeWorkspace && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Edit className="mr-2" />
                      <span>Manage </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onSelect={() => handleOpenDialog('rename', activeWorkspace)}>
                        <Edit className="mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleExportWorkspace}>
                        <Download className="mr-2" />
                        Export
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {workspaces.length > 1 && (
                        <DropdownMenuItem onSelect={() => handleOpenDialog('delete', activeWorkspace)} className="text-destructive">
                          <Trash2 className="mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <div className="border-b border-border">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex items-center gap-1 p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={addTab}
                >
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">Add new tab</span>
                </Button>
                {tabs.map((tab) => (
                  <div key={tab.id} className="relative group/tab shrink-0">
                    <Button
                      variant={activeTabId === tab.id ? 'secondary' : 'ghost'}
                      className="h-9 pr-7"
                      onClick={() => setActiveTabId(tab.id)}
                    >
                      <div className="flex items-center gap-2 max-w-[150px] sm:max-w-[200px]">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', getMethodDotColor(tab.method))} />
                        <span className="truncate">{tab.name || tab.url || 'Untitled'}</span>
                      </div>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover/tab:opacity-100 hover:bg-destructive/20 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTabRequest(tab.id);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      <span className="sr-only">Close tab</span>
                    </Button>
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          <main className="flex-1 overflow-auto bg-background text-foreground p-4 sm:p-6 lg:p-8">
            {!activeTab ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="max-w-7xl mx-auto space-y-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <Input
                        placeholder="Request Name (e.g. 'Get all users')"
                        value={activeTab.name}
                        onChange={(e) => updateActiveTab({ name: e.target.value })}
                      />
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Select value={activeTab.method} onValueChange={(v: HttpMethod) => updateActiveTab({ method: v })}>
                          <SelectTrigger className={cn("w-full sm:w-[120px] font-bold", getMethodSelectVariant(activeTab.method))}>
                            <SelectValue placeholder="Method" />
                          </SelectTrigger>
                          <SelectContent>
                            {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as HttpMethod[]).map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="text"
                          placeholder="https://api.example.com/v1/users  or  curl …"
                          value={activeTab.url}
                          onChange={(e) => handleUrlChange(e.target.value)}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData('text');
                            if (isCurlCommand(text)) {
                              e.preventDefault();
                              handleUrlChange(text);
                            }
                          }}
                          className="font-code flex-1"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setAutomateDialogOpen(true)}
                          className={cn(
                            "w-full sm:w-auto",
                            isAutomationActive && "bg-accent/50 text-accent-foreground"
                          )}
                        >
                          <Zap className={cn(isAutomationActive && "animate-pulse text-primary")} />
                          <span>{isAutomationActive ? 'Running...' : 'Automate'}</span>
                        </Button>
                        <Button type="submit" disabled={activeTab.isLoading} className="w-full sm:w-auto">
                          {activeTab.isLoading ? <Loader2 className="animate-spin" /> : <Send />}
                          <span>Send</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <Tabs defaultValue="headers" className="w-full" value={requestTab} onValueChange={(v) => setRequestTab(v)}>
                      <CardHeader className="flex-row items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <CardTitle className="text-lg">
                            Request:
                          </CardTitle>
                          <TabsList>
                            <TabsTrigger value="headers">Headers</TabsTrigger>
                            <TabsTrigger value="body">Body</TabsTrigger>
                          </TabsList>
                        </div>
                      </CardHeader>
                      <TabsContent value="headers" className="mt-0">
                        <CardContent className="p-4 pt-0 space-y-2">
                          {activeTab.headers.map((header) => (
                            <div key={header.id} className="flex gap-2 items-center">
                              <Checkbox
                                id={`enabled-${header.id}`}
                                checked={header.enabled}
                                onCheckedChange={(checked) => handleHeaderChange(header.id, 'enabled', !!checked)}
                              />
                              <Input
                                placeholder="Key"
                                value={header.key}
                                onChange={(e) => handleHeaderChange(header.id, 'key', e.target.value)}
                                className="font-code"
                              />
                              <Input
                                placeholder="Value"
                                value={header.value}
                                onChange={(e) => handleHeaderChange(header.id, 'value', e.target.value)}
                                className="font-code"
                              />
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveHeader(header.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button type="button" variant="outline" size="sm" onClick={handleAddHeader}>
                            <Plus className="mr-2 h-4 w-4" /> Add Header
                          </Button>
                        </CardContent>
                      </TabsContent>
                      <TabsContent value="body" className="mt-0">
                        <CardContent className="p-4 pt-2">
                          <RadioGroup
                            value={activeTab.bodyType}
                            onValueChange={(value: BodyType) => updateActiveTab({ bodyType: value })}
                            className="flex items-center gap-4 mb-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="none" id="bt-none" />
                              <Label htmlFor="bt-none">None</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="json" id="bt-json" />
                              <Label htmlFor="bt-json">JSON</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="form-data" id="bt-form" />
                              <Label htmlFor="bt-form">Form Data</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="text" id="bt-text" />
                              <Label htmlFor="bt-text">Text</Label>
                            </div>
                          </RadioGroup>

                          {['json', 'text'].includes(activeTab.bodyType) && (
                            <div className="relative">
                              <Textarea
                                placeholder={activeTab.bodyType === 'json' ? '{ "key": "value" }' : 'Plain text content'}
                                value={activeTab.requestBody}
                                onChange={(e) => updateActiveTab({ requestBody: e.target.value })}
                                onBlur={() => {
                                  if (activeTab.bodyType === 'json' && activeTab.requestBody) {
                                    try {
                                      const parsed = JSON.parse(activeTab.requestBody);
                                      const pretty = JSON.stringify(parsed, null, 2);
                                      if (activeTab.requestBody !== pretty) {
                                        updateActiveTab({ requestBody: pretty });
                                      }
                                    } catch (e) {
                                      // Silently fail on blur if JSON is invalid
                                    }
                                  }
                                }}
                                className="font-code min-h-[200px] bg-muted/50"
                              />
                            </div>
                          )}

                          {activeTab.bodyType === 'form-data' && (
                            <div className="space-y-2">
                              {activeTab.formData.map((item) => (
                                <div key={item.id} className="flex gap-2 items-center">
                                  <Checkbox
                                    id={`fd-enabled-${item.id}`}
                                    checked={item.enabled}
                                    onCheckedChange={(checked) => handleFormDataChange(item.id, 'enabled', !!checked)}
                                  />
                                  <Input
                                    placeholder="Key"
                                    value={item.key}
                                    onChange={(e) => handleFormDataChange(item.id, 'key', e.target.value)}
                                    className="font-code"
                                  />
                                  <Input
                                    placeholder="Value"
                                    value={item.value}
                                    onChange={(e) => handleFormDataChange(item.id, 'value', e.target.value)}
                                    className="font-code"
                                  />
                                  <Button variant="ghost" size="icon" onClick={() => handleRemoveFormData(item.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                              <Button type="button" variant="outline" size="sm" onClick={handleAddFormData}>
                                <Plus className="mr-2 h-4 w-4" /> Add Form Field
                              </Button>
                            </div>
                          )}

                          {activeTab.bodyType === 'none' && (
                            <div className="flex items-center justify-center min-h-[200px] text-muted-foreground bg-muted/50 rounded-md">
                              <p>This request has no body.</p>
                            </div>
                          )}

                        </CardContent>
                      </TabsContent>
                    </Tabs>
                  </Card>
                </form>

                <Card className="min-h-[300px]">
                  {activeTab.isLoading && (
                    <div className="flex items-center justify-center h-[300px]">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                  {activeTab.apiError && !activeTab.isLoading && (
                    <div className="flex flex-col items-center justify-center h-[300px] text-center text-destructive p-4">
                      <ServerCrash className="h-12 w-12 mb-4" />
                      <p className="font-bold text-lg">Request Failed</p>
                      <p className="text-sm font-code">{activeTab.apiError.error}</p>
                    </div>
                  )}
                  {!activeTab.response && !activeTab.apiError && !activeTab.isLoading && (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      <p>Send a request to see the response here</p>
                    </div>
                  )}
                  {activeTab.response && !activeTab.isLoading && (
                    <Tabs defaultValue="body" className="w-full" value={responseTab} onValueChange={setResponseTab}>
                      <div className="p-4 flex items-center justify-between border-b">
                        <div className="flex items-center gap-4">
                          <h3 className="text-lg font-semibold tracking-tight">
                            Response:
                          </h3>
                          <TabsList>
                            <TabsTrigger value="headers">Headers</TabsTrigger>
                            <TabsTrigger value="body">Body</TabsTrigger>
                          </TabsList>
                        </div>
                        <Badge className={cn('font-mono', getStatusBadgeVariant(activeTab.response.status))}>
                          {activeTab.response.status} {activeTab.response.statusText}
                        </Badge>
                      </div>
                      <TabsContent value="body" className="mt-0">
                        <CardContent className="p-0">
                          <Tabs defaultValue="pretty" className="w-full">
                            <TabsList className="mx-4 mt-4">
                              <TabsTrigger value="pretty">Pretty</TabsTrigger>
                              <TabsTrigger value="raw">Raw</TabsTrigger>
                              {isHtmlResponse && <TabsTrigger value="preview">Preview</TabsTrigger>}
                            </TabsList>
                            <TabsContent value="pretty" className="mt-0">
                              <ScrollArea className="h-[400px]">
                                <pre className="p-4 pt-0 font-code text-sm whitespace-pre-wrap break-all">
                                  <code>{prettyBody}</code>
                                </pre>
                              </ScrollArea>
                            </TabsContent>
                            <TabsContent value="raw" className="mt-0">
                              <ScrollArea className="h-[400px]">
                                <pre className="p-4 pt-0 font-code text-sm whitespace-pre-wrap break-all">
                                  <code>{rawBody}</code>
                                </pre>
                              </ScrollArea>
                            </TabsContent>
                            {isHtmlResponse && (
                              <TabsContent value="preview" className="mt-0">
                                <ScrollArea className="h-[400px]">
                                  <iframe
                                    srcDoc={rawBody}
                                    className="w-full h-full border-0 bg-white"
                                    title="Response Preview"
                                  />
                                </ScrollArea>
                              </TabsContent>
                            )}
                          </Tabs>
                        </CardContent>
                      </TabsContent>
                      <TabsContent value="headers" className="mt-0">
                        <CardContent className="p-4 pt-0">
                          <ScrollArea className="h-[400px]">
                            <div className="pt-4 font-code text-sm space-y-1">
                              {Object.entries(activeTab.response.headers).map(([key, value]) => (
                                <div key={key}>
                                  <span className="font-semibold text-accent">{key}:</span> {value}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </TabsContent>
                    </Tabs>
                  )}
                </Card>
              </div>
            )}
          </main>
        </div>
      </SidebarInset>

      {/* Workspace Modals */}
      <Dialog open={dialogState.type === 'create' || dialogState.type === 'rename'} onOpenChange={(isOpen) => !isOpen && closeDialogs()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogState.type === 'create' ? 'Create New Workspace' : 'Rename Workspace'}</DialogTitle>
          </DialogHeader>
          <form id="workspace-form" onSubmit={(e) => { e.preventDefault(); handleDialogSubmit(); }}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  ref={nameInputRef}
                  value={workspaceNameInput}
                  onChange={(e) => setWorkspaceNameInput(e.target.value)}
                  className="col-span-3"
                  placeholder="My Awesome Project"
                />
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="workspace-form">
              {dialogState.type === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialogState.type === 'delete'} onOpenChange={(isOpen) => !isOpen && closeDialogs()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the '{dialogState.workspace?.name}' workspace and all of its associated requests and history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWorkspace} variant="destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={tabToDeleteId !== null} onOpenChange={(isOpen) => !isOpen && setTabToDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing this tab will permanently delete its active automation configuration from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (tabToDeleteId) removeTab(tabToDeleteId);
              setTabToDeleteId(null);
            }} className="bg-destructive hover:bg-destructive/90 focus:ring-destructive text-destructive-foreground">
              Delete & Close Tab
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showClearHistoryDialog} onOpenChange={setShowClearHistoryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the request history for this workspace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              clearHistory();
              toast({ title: 'History Cleared', description: 'Your request history for this workspace has been deleted.' });
              setShowClearHistoryDialog(false);
            }} variant="destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Automate Dialog */}
      <Dialog open={isAutomateDialogOpen} onOpenChange={setAutomateDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Automate Request</DialogTitle>
            <DialogDescription>
              Create a webhook to trigger this API request automatically. Map incoming data to your request headers and body.
            </DialogDescription>
          </DialogHeader>
          {automationConfig && activeTab && (
            <div className="grid gap-6 py-4">
              <div>
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input id="webhook-url" readOnly value={`https://requestcall.web.app/webhook/${activeTab.id}`} className="font-code" />
                  <Button type="button" size="icon" variant="outline" onClick={() => {
                    navigator.clipboard.writeText(`https://requestcall.web.app/webhook/${activeTab.id}`);
                    toast({ title: "Webhook URL copied!" });
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="flex flex-col gap-4">
                  <div>
                    <Label htmlFor="sample-data">Sample Incoming Data (JSON)</Label>
                    <Textarea
                      id="sample-data"
                      placeholder='{ "user": { "id": "123" }, "token": "abc-xyz" }'
                      value={automationConfig.sampleData}
                      onChange={(e) => setAutomationConfig(prev => ({ ...prev!, sampleData: e.target.value }))}
                      className="font-code h-48 mt-1"
                    />
                  </div>
                  <div>
                    <Label>Draggable Keys</Label>
                    <Card className="mt-1 h-48 overflow-auto">
                      <CardContent className="p-2">
                        {parsedSampleData ? <JsonTreeView data={parsedSampleData} /> : <p className="text-sm text-muted-foreground p-2">Enter valid JSON above to see draggable keys.</p>}
                      </CardContent>
                    </Card>
                  </div>
                </div>
                <ScrollArea className="h-96">
                  <div className="space-y-6 pr-4">
                    <div>
                      <h4 className="font-semibold mb-2">Header Mappings</h4>
                      <div className="space-y-2">
                        {activeTab.headers.filter(h => h.enabled && h.key).length > 0 ? activeTab.headers.filter(h => h.enabled && h.key).map(header => (
                          <div key={header.id} className="grid grid-cols-2 items-center gap-2">
                            <Label htmlFor={`header-map-${header.id}`} className="truncate font-normal text-muted-foreground">{header.key}</Label>
                            <Input
                              id={`header-map-${header.id}`}
                              placeholder="e.g., headers.x-api-key"
                              value={automationConfig.headerMappings[header.key] || ''}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const path = e.dataTransfer.getData('text/plain');
                                if (path) {
                                  handleHeaderMappingChange(header.key, path);
                                }
                              }}
                              onChange={(e) => handleHeaderMappingChange(header.key, e.target.value)}
                              className="font-code"
                            />
                          </div>
                        )) : <p className="text-sm text-muted-foreground">No headers to map.</p>}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Body Mappings</h4>
                      <div className="space-y-2">
                        {getRequestBodyKeys().length > 0 ? getRequestBodyKeys().map(key => (
                          <div key={key} className="grid grid-cols-2 items-center gap-2">
                            <Label htmlFor={`body-map-${key}`} className="truncate font-normal text-muted-foreground">{key}</Label>
                            <Input
                              id={`body-map-${key}`}
                              placeholder="e.g., body.user.id"
                              value={automationConfig.bodyMappings[key] || ''}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const path = e.dataTransfer.getData('text/plain');
                                if (path) {
                                  handleBodyMappingChange(key, path);
                                }
                              }}
                              onChange={(e) => handleBodyMappingChange(key, e.target.value)}
                              className="font-code"
                            />
                          </div>
                        )) : <p className="text-sm text-muted-foreground">Request body is not a valid JSON object.</p>}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant={automationConfig?.disabled ? 'secondary' : 'outline'}
              onClick={handleToggleAutomationStatus}
              className="mr-auto"
            >
              {automationConfig?.disabled ? <Play /> : <Square />}
              <span>{automationConfig?.disabled ? 'Enable' : 'Disable'}</span>
            </Button>
            <Button type="button" onClick={handleSaveAutomation} disabled={isSavingAutomation}>
              {isSavingAutomation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        type="file"
        ref={historyFileInputRef}
        onChange={handleHistoryFileImport}
        className="hidden"
        accept="application/json"
      />
      <input
        type="file"
        ref={workspaceFileInputRef}
        onChange={handleWorkspaceFileImport}
        className="hidden"
        accept="application/json"
      />
    </SidebarProvider>
  );
}
