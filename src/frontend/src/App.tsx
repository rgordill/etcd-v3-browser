import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import '@patternfly/patternfly/patternfly.css';
import {
  Page,
  PageSection,
  Masthead,
  MastheadMain,
  MastheadBrand,
  MastheadContent,
  TreeView,
  TreeViewDataItem,
  Card,
  CardBody,
  CardTitle,
  CodeBlock,
  CodeBlockCode,
  Spinner,
  EmptyState,
  EmptyStateBody,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Button,
  Alert,
  AlertActionCloseButton,
  TextInput,
  Flex,
  FlexItem,
  Label,
  Form,
  FormGroup,
  ActionGroup,
  HelperText,
  HelperTextItem,
  InputGroup,
  InputGroupItem,
  Select,
  SelectOption,
  MenuToggle,
  MenuToggleElement,
  Tab,
  Tabs,
  TabTitleText,
  Dropdown,
  DropdownItem,
  DropdownList,
  Tooltip,
  Popover,
  FormGroupLabelHelp,
  MultipleFileUpload,
  MultipleFileUploadMain,
  DropEvent,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import { PemFileField } from './PemFileField';
import {
  FolderIcon,
  FolderOpenIcon,
  KeyIcon,
  DatabaseIcon,
  SyncAltIcon,
  SearchIcon,
  PluggedIcon,
  UnpluggedIcon,
  TimesIcon,
  CogIcon,
  SunIcon,
  MoonIcon,
  AdjustIcon,
  UploadIcon,
} from '@patternfly/react-icons';
import { SyntaxCodeBlock } from './SyntaxCodeBlock';
import { CopyButton } from './CopyButton';
import { jsonToYaml, parseJsonText } from './value-format';
import { useTheme, ThemeChoice } from './useTheme';
import { ThemeContext } from './ThemeContext';

const etcdLogoLightUrl = `${process.env.PUBLIC_URL}/etcd-logo.svg`;
const etcdLogoDarkUrl = `${process.env.PUBLIC_URL}/etcd-logo-dark.svg`;

const DISCLAIMER_TEXT =
  'This project is not official, affiliated with, or endorsed by the etcd project, the CNCF, or the Linux Foundation. '
  + 'Connecting to a live etcd cluster can impact performance. It is recommended to load a snapshot into an staloned etcd server. '
  + 'Use at your own risk';

interface EtcdEntry {
  key: string;
  name: string;
  isLeaf: boolean;
}

interface ConnectionInfo {
  endpoint: string;
  version: string;
  dbSize: string;
}

interface TlsOptions {
  skipTlsVerify: boolean;
  serverCa: string;
  clientAuth: boolean;
  clientCert: string;
  clientKey: string;
}

interface K8sResource {
  apiVersion: string;
  kind: string;
  yaml: string;
  json: string;
}

interface ValueResult {
  value: string | null;
  encoding: 'text' | 'binary';
  size: number;
  k8sResource?: K8sResource;
}

const API_BASE = process.env.REACT_APP_API_URL || '';

function endpointParam(endpoint: string): string {
  return `endpoint=${encodeURIComponent(endpoint)}`;
}

async function fetchConfig(): Promise<{ defaultEndpoint: string }> {
  const res = await fetch(`${API_BASE}/api/config`);
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

async function connectToEtcd(endpoint: string, tlsOptions?: TlsOptions): Promise<ConnectionInfo> {
  const res = await fetch(`${API_BASE}/api/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint,
      ...(tlsOptions && { tls: tlsOptions }),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Connection failed (${res.status})`);
  return { endpoint: data.endpoint, version: data.version, dbSize: data.dbSize };
}

interface SnapshotConfig {
  maxSizeBytes: number;
}

interface SnapshotResult {
  snapshotName: string;
  size: number;
  keyCount: number;
}

async function fetchSnapshotConfig(): Promise<SnapshotConfig> {
  const res = await fetch(`${API_BASE}/api/snapshot/config`);
  if (!res.ok) throw new Error('Failed to fetch snapshot config');
  return res.json();
}

async function uploadSnapshot(file: File): Promise<SnapshotResult> {
  const formData = new FormData();
  formData.append('snapshot', file);
  const res = await fetch(`${API_BASE}/api/snapshot/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Snapshot upload failed (${res.status})`);
  return data;
}

async function unloadSnapshot(): Promise<void> {
  await fetch(`${API_BASE}/api/snapshot/unload`, { method: 'POST' });
}

async function fetchKeys(endpoint: string, prefix: string): Promise<EtcdEntry[]> {
  const res = await fetch(`${API_BASE}/api/keys?${endpointParam(endpoint)}&prefix=${encodeURIComponent(prefix)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch keys: ${res.statusText}`);
  }
  return res.json();
}

async function fetchValue(endpoint: string, key: string): Promise<ValueResult> {
  const res = await fetch(`${API_BASE}/api/key?${endpointParam(endpoint)}&key=${encodeURIComponent(key)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch value: ${res.statusText}`);
  }
  const data = await res.json();
  return {
    value: data.value,
    encoding: data.encoding || 'text',
    size: data.size || 0,
    k8sResource: data.k8sResource || undefined,
  };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function formatHexDump(bytes: Uint8Array): string {
  const lines: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.slice(offset, offset + 16);
    const hex = Array.from(chunk).map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = Array.from(chunk).map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  |${ascii}|`);
  }
  return lines.join('\n');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function replaceNodeChildren(
  nodes: TreeViewDataItem[],
  targetId: string,
  newChildren: TreeViewDataItem[],
): TreeViewDataItem[] {
  return nodes.map((node) => {
    if (node.id === targetId) {
      return { ...node, children: newChildren.length > 0 ? newChildren : undefined };
    }
    if (node.children) {
      return { ...node, children: replaceNodeChildren(node.children, targetId, newChildren) };
    }
    return node;
  });
}

function defaultBinaryTab(result: ValueResult): string {
  if (result.k8sResource) return 'yaml';
  return 'hex';
}

function defaultTextTab(value: string): string {
  return parseJsonText(value) ? 'yaml' : 'text';
}

function ValueMetaBar({ copyText, children }: { copyText: string; children: React.ReactNode }) {
  return (
    <Flex
      gap={{ default: 'gapSm' }}
      alignItems={{ default: 'alignItemsCenter' }}
      style={{ marginBottom: 'var(--pf-t--global--spacer--sm)' }}
    >
      {children}
      <FlexItem style={{ marginLeft: 'auto' }}>
        <CopyButton text={copyText} />
      </FlexItem>
    </Flex>
  );
}

function textFormatCopyContent(
  activeTab: string,
  value: string,
  yamlText: string,
  jsonFormatted: string,
): string {
  switch (activeTab) {
    case 'yaml':
      return yamlText;
    case 'json':
      return jsonFormatted;
    case 'raw':
    case 'text':
    default:
      return value;
  }
}

function binaryFormatCopyContent(
  activeTab: string,
  rawBase64: string,
  hexDump: string,
  k8s?: K8sResource,
): string {
  switch (activeTab) {
    case 'yaml':
      return k8s?.yaml ?? hexDump;
    case 'json':
      return k8s?.json ?? rawBase64;
    case 'hex':
      return hexDump;
    case 'base64':
      return rawBase64;
    default:
      return hexDump;
  }
}

function TextValueDisplay({ value }: { value: string }) {
  const jsonInfo = useMemo(() => parseJsonText(value), [value]);
  const yamlText = useMemo(
    () => (jsonInfo ? jsonToYaml(jsonInfo.parsed) : ''),
    [jsonInfo],
  );
  const [activeTab, setActiveTab] = useState(defaultTextTab(value));

  useEffect(() => {
    setActiveTab(defaultTextTab(value));
  }, [value]);

  const copyText = useMemo(
    () => (jsonInfo
      ? textFormatCopyContent(activeTab, value, yamlText, jsonInfo.formatted)
      : value),
    [activeTab, value, yamlText, jsonInfo],
  );

  if (!jsonInfo) {
    return (
      <>
        <ValueMetaBar copyText={copyText}>
          <FlexItem>
            <Label isCompact color="green">Text</Label>
          </FlexItem>
          <FlexItem>
            <Label isCompact>{formatSize(value.length)}</Label>
          </FlexItem>
        </ValueMetaBar>
        <SyntaxCodeBlock code={value} language="text" />
      </>
    );
  }

  return (
    <>
      <ValueMetaBar copyText={copyText}>
        <FlexItem>
          <Label isCompact color="green">Text</Label>
        </FlexItem>
        <FlexItem>
          <Label isCompact color="blue">JSON</Label>
        </FlexItem>
        <FlexItem>
          <Label isCompact>{formatSize(value.length)}</Label>
        </FlexItem>
      </ValueMetaBar>
      <Tabs activeKey={activeTab} onSelect={(_e, key) => setActiveTab(String(key))} isBox>
        <Tab eventKey="yaml" title={<TabTitleText>YAML</TabTitleText>}>
          <div style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}>
            <SyntaxCodeBlock code={yamlText} language="yaml" />
          </div>
        </Tab>
        <Tab eventKey="json" title={<TabTitleText>JSON</TabTitleText>}>
          <div style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}>
            <SyntaxCodeBlock code={jsonInfo.formatted} language="json" />
          </div>
        </Tab>
        <Tab eventKey="raw" title={<TabTitleText>Raw</TabTitleText>}>
          <div style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}>
            <SyntaxCodeBlock code={value} language="text" />
          </div>
        </Tab>
      </Tabs>
    </>
  );
}

function BinaryValueDisplay({ result }: { result: ValueResult & { value: string } }) {
  const k8s = result.k8sResource;
  const [activeTab, setActiveTab] = useState(() => defaultBinaryTab(result));
  const bytes = useMemo(() => base64ToBytes(result.value), [result.value]);
  const hexDump = useMemo(() => formatHexDump(bytes), [bytes]);
  const copyText = useMemo(
    () => binaryFormatCopyContent(activeTab, result.value, hexDump, k8s),
    [activeTab, result.value, hexDump, k8s],
  );

  useEffect(() => {
    setActiveTab(defaultBinaryTab(result));
  }, [result]);

  return (
    <>
      <ValueMetaBar copyText={copyText}>
        <FlexItem>
          <Label isCompact color="orange">Binary</Label>
        </FlexItem>
        <FlexItem>
          <Label isCompact>{formatSize(result.size)}</Label>
        </FlexItem>
        {k8s && (
          <>
            <FlexItem>
              <Label isCompact color="blue">{k8s.kind}</Label>
            </FlexItem>
            <FlexItem>
              <Label isCompact color="teal">{k8s.apiVersion}</Label>
            </FlexItem>
          </>
        )}
      </ValueMetaBar>
      <Tabs activeKey={activeTab} onSelect={(_e, key) => setActiveTab(String(key))} isBox>
        {k8s && (
          <Tab eventKey="yaml" title={<TabTitleText>YAML</TabTitleText>}>
            <div style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}>
              <SyntaxCodeBlock code={k8s.yaml} language="yaml" />
            </div>
          </Tab>
        )}
        {k8s && (
          <Tab eventKey="json" title={<TabTitleText>JSON</TabTitleText>}>
            <div style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}>
              <SyntaxCodeBlock code={k8s.json} language="json" />
            </div>
          </Tab>
        )}
        <Tab eventKey="hex" title={<TabTitleText>Hex Dump</TabTitleText>}>
          <div style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}>
            <CodeBlock>
              <CodeBlockCode
                style={{ fontFamily: 'var(--pf-t--global--font--family--mono)', fontSize: '0.8125rem', lineHeight: 1.5 }}
              >
                {hexDump}
              </CodeBlockCode>
            </CodeBlock>
          </div>
        </Tab>
        <Tab eventKey="base64" title={<TabTitleText>Base64</TabTitleText>}>
          <div style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}>
            <CodeBlock>
              <CodeBlockCode style={{ wordBreak: 'break-all' }}>{result.value}</CodeBlockCode>
            </CodeBlock>
          </div>
        </Tab>
      </Tabs>
    </>
  );
}

function ValueDisplay({ result }: { result: ValueResult }) {
  if (result.value === null) {
    return (
      <EmptyState headingLevel="h4" icon={KeyIcon} titleText="Key has no value">
        <EmptyStateBody>This key exists but has an empty value.</EmptyStateBody>
      </EmptyState>
    );
  }

  if (result.encoding === 'text') {
    return <TextValueDisplay value={result.value} />;
  }

  return <BinaryValueDisplay result={{ ...result, value: result.value }} />;
}

const THEME_LABELS: Record<ThemeChoice, { icon: React.ReactNode; label: string }> = {
  light: { icon: <SunIcon />, label: 'Light' },
  dark: { icon: <MoonIcon />, label: 'Dark' },
  auto: { icon: <AdjustIcon />, label: 'System default' },
};

function App() {
  const { choice: themeChoice, effective: effectiveTheme, setChoice: setThemeChoice } = useTheme();
  const etcdLogoUrl = effectiveTheme === 'dark' ? etcdLogoDarkUrl : etcdLogoLightUrl;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'connect' | 'snapshot'>('connect');

  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('2379');
  const [protocol, setProtocol] = useState('http');
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [skipTlsVerify, setSkipTlsVerify] = useState(false);
  const [skipTlsOpen, setSkipTlsOpen] = useState(false);
  const [serverCa, setServerCa] = useState('');
  const [clientAuth, setClientAuth] = useState(false);
  const [clientAuthOpen, setClientAuthOpen] = useState(false);
  const [clientCert, setClientCert] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [recentEndpoints, setRecentEndpoints] = useState<string[]>([]);
  const configLoaded = useRef(false);

  const [treeData, setTreeData] = useState<TreeViewDataItem[]>([]);
  const [activeItems, setActiveItems] = useState<TreeViewDataItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<ValueResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [valueLoading, setValueLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');

  const [snapshotFile, setSnapshotFile] = useState<File | null>(null);
  const [snapshotUploading, setSnapshotUploading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotMaxSize, setSnapshotMaxSize] = useState<number>(4 * 1024 * 1024 * 1024);
  const [snapshotName, setSnapshotName] = useState<string | null>(null);

  useEffect(() => {
    if (configLoaded.current) return;
    configLoaded.current = true;
    fetchConfig()
      .then((cfg) => {
        if (cfg.defaultEndpoint) {
          try {
            const url = new URL(cfg.defaultEndpoint);
            setProtocol(url.protocol.replace(':', ''));
            setHost(url.hostname);
            setPort(url.port || '2379');
          } catch {
            setHost(cfg.defaultEndpoint);
          }
        }
      })
      .catch(() => {});

    fetchSnapshotConfig()
      .then((cfg) => setSnapshotMaxSize(cfg.maxSizeBytes))
      .catch(() => {});

    const saved = localStorage.getItem('etcd-browser-recent');
    if (saved) {
      try { setRecentEndpoints(JSON.parse(saved)); } catch {}
    }
  }, []);

  const currentEndpoint = `${protocol}://${host}:${port}`;

  const addRecentEndpoint = useCallback((ep: string) => {
    setRecentEndpoints((prev) => {
      const next = [ep, ...prev.filter((e) => e !== ep)].slice(0, 10);
      localStorage.setItem('etcd-browser-recent', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleConnect = useCallback(async () => {
    if (!host) {
      setConnectionError('Host is required');
      return;
    }
    const ep = currentEndpoint;
    setConnecting(true);
    setConnectionError(null);

    const tlsOptions = protocol === 'https' ? {
      skipTlsVerify,
      serverCa,
      clientAuth,
      clientCert,
      clientKey,
    } : undefined;

    try {
      const info = await connectToEtcd(ep, tlsOptions);
      setConnection(info);
      addRecentEndpoint(ep);
      setTreeData([]);
      setSelectedKey(null);
      setSelectedResult(null);
      setActiveItems([]);
      setFilterText('');
    } catch (err: any) {
      setConnectionError(err.message);
    } finally {
      setConnecting(false);
    }
  }, [host, currentEndpoint, addRecentEndpoint, protocol, skipTlsVerify, serverCa, clientAuth, clientCert, clientKey]);

  const handleDisconnect = useCallback(() => {
    if (snapshotName) {
      unloadSnapshot().catch(() => {});
      setSnapshotName(null);
      setSnapshotFile(null);
    }
    setConnection(null);
    setTreeData([]);
    setSelectedKey(null);
    setSelectedResult(null);
    setActiveItems([]);
    setError(null);
    setFilterText('');
  }, [snapshotName]);

  const handleSnapshotUpload = useCallback(async () => {
    if (!snapshotFile) {
      setSnapshotError('Please select a snapshot file');
      return;
    }
    if (snapshotFile.size > snapshotMaxSize) {
      const maxMB = (snapshotMaxSize / (1024 * 1024)).toFixed(0);
      setSnapshotError(`File exceeds maximum size of ${maxMB} MB`);
      return;
    }
    setSnapshotUploading(true);
    setSnapshotError(null);
    try {
      const result = await uploadSnapshot(snapshotFile);
      setConnection({ endpoint: 'snapshot://local', version: 'snapshot', dbSize: String(result.size) });
      setSnapshotName(result.snapshotName);
      setTreeData([]);
      setSelectedKey(null);
      setSelectedResult(null);
      setActiveItems([]);
      setFilterText('');
    } catch (err: any) {
      setSnapshotError(err.message);
    } finally {
      setSnapshotUploading(false);
    }
  }, [snapshotFile, snapshotMaxSize]);

  const handleSnapshotDrop = useCallback((_event: DropEvent, files: File[]) => {
    if (files.length > 0) {
      setSnapshotFile(files[0]);
      setSnapshotError(null);
    }
  }, []);

  const selectRecentEndpoint = useCallback((ep: string) => {
    try {
      const url = new URL(ep);
      setProtocol(url.protocol.replace(':', ''));
      setHost(url.hostname);
      setPort(url.port || '2379');
    } catch {
      setHost(ep);
    }
  }, []);

  const buildTreeItems = useCallback((entries: EtcdEntry[]): TreeViewDataItem[] => {
    return entries.map((entry) => {
      if (entry.isLeaf) {
        return { id: entry.key, name: entry.name, icon: <KeyIcon /> };
      }
      return {
        id: entry.key,
        name: entry.name,
        icon: <FolderIcon />,
        expandedIcon: <FolderOpenIcon />,
        children: [{ id: `${entry.key}__loading`, name: <Spinner size="sm" /> }],
      };
    });
  }, []);

  const loadRoot = useCallback(async () => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    try {
      const entries = await fetchKeys(connection.endpoint, '');
      setTreeData(buildTreeItems(entries));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connection, buildTreeItems]);

  useEffect(() => {
    if (connection) loadRoot();
  }, [connection, loadRoot]);

  const handleExpand = async (_event: React.MouseEvent, item: TreeViewDataItem) => {
    if (!connection || !item.id || !item.children) return;
    const isPlaceholder = item.children.length === 1 && item.children[0].id?.endsWith('__loading');
    if (!isPlaceholder) return;

    try {
      const entries = await fetchKeys(connection.endpoint, item.id);
      const childItems = buildTreeItems(entries);
      setTreeData((prev) => replaceNodeChildren(prev, item.id!, childItems));
    } catch (err: any) {
      setError(`Failed to expand "${item.id}": ${err.message}`);
    }
  };

  const handleSelect = async (_event: React.MouseEvent, item: TreeViewDataItem) => {
    if (!connection) return;
    setActiveItems([item]);

    if (item.children && item.id) {
      handleExpand(_event, item);
      return;
    }

    if (item.id) {
      setSelectedKey(item.id);
      setValueLoading(true);
      try {
        const result = await fetchValue(connection.endpoint, item.id);
        setSelectedResult(result);
      } catch (err: any) {
        setError(`Failed to load value for "${item.id}": ${err.message}`);
        setSelectedResult(null);
      } finally {
        setValueLoading(false);
      }
    }
  };

  const filterTree = (items: TreeViewDataItem[], filter: string): TreeViewDataItem[] => {
    if (!filter) return items;
    const lowerFilter = filter.toLowerCase();
    return items
      .map((item) => {
        const nameStr = typeof item.name === 'string' ? item.name : '';
        const nameMatch = nameStr.toLowerCase().includes(lowerFilter);
        if (item.children) {
          const filteredChildren = filterTree(item.children, filter);
          if (nameMatch || filteredChildren.length > 0) {
            return { ...item, children: filteredChildren, defaultExpanded: true };
          }
          return null;
        }
        return nameMatch ? item : null;
      })
      .filter(Boolean) as TreeViewDataItem[];
  };

  const displayData = filterText ? filterTree(treeData, filterText) : treeData;

  const treeToolbar = (
    <Toolbar>
      <ToolbarContent>
        <ToolbarItem>
          <TextInput
            type="search"
            aria-label="Filter tree"
            placeholder="Filter keys..."
            value={filterText}
            onChange={(_event, value) => setFilterText(value)}
            customIcon={<SearchIcon />}
          />
        </ToolbarItem>
        <ToolbarItem>
          <Button variant="plain" aria-label="Refresh" onClick={loadRoot}>
            <SyncAltIcon />
          </Button>
        </ToolbarItem>
      </ToolbarContent>
    </Toolbar>
  );

  const connectionForm = (
    <div>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            handleConnect();
          }}
        >
          <FormGroup
            label="Endpoint"
            isRequired
            fieldId="etcd-endpoint"
            labelHelp={
              <Popover
                headerContent="Endpoint"
                bodyContent="The full address of the etcd server to connect to: protocol (http or https), hostname or IP address, and port number. The default etcd client port is 2379."
              >
                <FormGroupLabelHelp aria-label="More info for endpoint field" />
              </Popover>
            }
          >
            <InputGroup>
              <InputGroupItem>
                <Select
                  id="protocol-select"
                  isOpen={protocolOpen}
                  selected={protocol}
                  onSelect={(_event, value) => {
                    setProtocol(value as string);
                    setProtocolOpen(false);
                  }}
                  onOpenChange={setProtocolOpen}
                  toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                    <MenuToggle
                      ref={toggleRef}
                      onClick={() => setProtocolOpen(!protocolOpen)}
                      isExpanded={protocolOpen}
                      style={{ width: '110px' }}
                    >
                      {protocol}://
                    </MenuToggle>
                  )}
                >
                  <SelectOption value="http">http://</SelectOption>
                  <SelectOption value="https">https://</SelectOption>
                </Select>
              </InputGroupItem>
              <InputGroupItem isFill>
                <TextInput
                  id="etcd-host"
                  aria-label="etcd host"
                  placeholder="192.168.1.100"
                  value={host}
                  onChange={(_event, value) => setHost(value)}
                  isRequired
                />
              </InputGroupItem>
              <InputGroupItem>
                <TextInput
                  id="etcd-port"
                  aria-label="etcd port"
                  placeholder="2379"
                  value={port}
                  onChange={(_event, value) => setPort(value)}
                  style={{ width: '80px' }}
                />
              </InputGroupItem>
            </InputGroup>
            <HelperText>
              <HelperTextItem>
                Enter the etcd server address and port, then click Connect.
              </HelperTextItem>
            </HelperText>
          </FormGroup>

          {protocol === 'https' && (
            <>
              <FormGroup
                label="Skip TLS Verify"
                fieldId="skip-tls-verify"
                labelHelp={
                  <Popover
                    headerContent="Skip TLS Verify"
                    bodyContent="When enabled, the client will not validate the server's TLS certificate. This is useful for self-signed certificates or development environments, but should be avoided in production as it disables protection against man-in-the-middle attacks."
                  >
                    <FormGroupLabelHelp aria-label="More info for skip TLS verify field" />
                  </Popover>
                }
              >
                <Select
                  id="skip-tls-select"
                  isOpen={skipTlsOpen}
                  selected={skipTlsVerify ? 'true' : 'false'}
                  onSelect={(_event, value) => {
                    setSkipTlsVerify(value === 'true');
                    setSkipTlsOpen(false);
                  }}
                  onOpenChange={setSkipTlsOpen}
                  toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                    <MenuToggle
                      ref={toggleRef}
                      onClick={() => setSkipTlsOpen(!skipTlsOpen)}
                      isExpanded={skipTlsOpen}
                      style={{ width: '100px' }}
                    >
                      {skipTlsVerify ? 'true' : 'false'}
                    </MenuToggle>
                  )}
                >
                  <SelectOption value="false">false</SelectOption>
                  <SelectOption value="true">true</SelectOption>
                </Select>
                <HelperText>
                  <HelperTextItem>
                    If true, the client will not validate the server certificate.
                  </HelperTextItem>
                </HelperText>
              </FormGroup>

              {!skipTlsVerify && (
                <FormGroup
                  label="Server CA Certificate (optional)"
                  fieldId="server-ca"
                  labelHelp={
                    <Popover
                      headerContent="Server CA Certificate"
                      bodyContent="A PEM-encoded Certificate Authority (CA) certificate used to verify the etcd server's identity. Provide this when the server uses a certificate signed by a private or internal CA not present in the system trust store. If left empty, the system's default trusted certificates are used."
                    >
                      <FormGroupLabelHelp aria-label="More info for server CA certificate field" />
                    </Popover>
                  }
                >
                  <PemFileField
                    id="server-ca"
                    value={serverCa}
                    onChange={setServerCa}
                    placeholder="Upload or paste PEM-encoded CA certificate (.pem, .crt, .cer)"
                    browseButtonText="Load CA file"
                  />
                  <HelperText>
                    <HelperTextItem>
                      Optional PEM-encoded CA certificate to trust for server verification. If empty, system trust store is used.
                    </HelperTextItem>
                  </HelperText>
                </FormGroup>
              )}

              <FormGroup
                label="Client Authentication"
                fieldId="client-auth"
                labelHelp={
                  <Popover
                    headerContent="Client Authentication"
                    bodyContent="Enable mutual TLS (mTLS) authentication. When enabled, the client presents its own certificate and private key to the server, proving its identity. This is required when the etcd server is configured to verify client certificates."
                  >
                    <FormGroupLabelHelp aria-label="More info for client authentication field" />
                  </Popover>
                }
              >
                <Select
                  id="client-auth-select"
                  isOpen={clientAuthOpen}
                  selected={clientAuth ? 'true' : 'false'}
                  onSelect={(_event, value) => {
                    setClientAuth(value === 'true');
                    setClientAuthOpen(false);
                  }}
                  onOpenChange={setClientAuthOpen}
                  toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                    <MenuToggle
                      ref={toggleRef}
                      onClick={() => setClientAuthOpen(!clientAuthOpen)}
                      isExpanded={clientAuthOpen}
                      style={{ width: '100px' }}
                    >
                      {clientAuth ? 'true' : 'false'}
                    </MenuToggle>
                  )}
                >
                  <SelectOption value="false">false</SelectOption>
                  <SelectOption value="true">true</SelectOption>
                </Select>
                <HelperText>
                  <HelperTextItem>
                    Enable mutual TLS (mTLS) client certificate authentication.
                  </HelperTextItem>
                </HelperText>
              </FormGroup>

              {clientAuth && (
                <>
                  <FormGroup
                    label="Client Certificate"
                    isRequired
                    fieldId="client-cert"
                    labelHelp={
                      <Popover
                        headerContent="Client Certificate"
                        bodyContent="A PEM-encoded X.509 certificate that identifies this client to the etcd server. It must be signed by a CA that the server trusts. This is the public part of the client's mTLS credentials."
                      >
                        <FormGroupLabelHelp aria-label="More info for client certificate field" />
                      </Popover>
                    }
                  >
                    <PemFileField
                      id="client-cert"
                      value={clientCert}
                      onChange={setClientCert}
                      placeholder="Upload or paste PEM client certificate (.pem, .crt)"
                      browseButtonText="Load certificate"
                      isRequired
                    />
                  </FormGroup>
                  <FormGroup
                    label="Client Key"
                    isRequired
                    fieldId="client-key"
                    labelHelp={
                      <Popover
                        headerContent="Client Key"
                        bodyContent="A PEM-encoded private key corresponding to the client certificate. This key is used to prove ownership of the client certificate during the TLS handshake. Keep this file secure — it should never be shared or exposed publicly."
                      >
                        <FormGroupLabelHelp aria-label="More info for client key field" />
                      </Popover>
                    }
                  >
                    <PemFileField
                      id="client-key"
                      value={clientKey}
                      onChange={setClientKey}
                      placeholder="Upload or paste PEM private key (.pem, .key)"
                      browseButtonText="Load private key"
                      isRequired
                    />
                  </FormGroup>
                </>
              )}
            </>
          )}

          {connectionError && (
            <Alert
              variant="danger"
              isInline
              isPlain
              title={connectionError}
              actionClose={<AlertActionCloseButton onClose={() => setConnectionError(null)} />}
            />
          )}

          <ActionGroup>
            <Button
              variant="primary"
              type="submit"
              isLoading={connecting}
              isDisabled={connecting || !host}
              icon={<PluggedIcon />}
            >
              Connect
            </Button>
          </ActionGroup>
        </Form>

        {recentEndpoints.length > 0 && (
          <>
            <Title headingLevel="h4" size="md" style={{ marginTop: 'var(--pf-t--global--spacer--lg)' }}>
              Recent connections
            </Title>
            <Flex direction={{ default: 'column' }} gap={{ default: 'gapXs' }} style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}>
              {recentEndpoints.map((ep) => (
                <FlexItem key={ep}>
                  <Button variant="link" isInline onClick={() => selectRecentEndpoint(ep)}>
                    {ep}
                  </Button>
                </FlexItem>
              ))}
            </Flex>
          </>
        )}
    </div>
  );

  const snapshotForm = (
    <div>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            handleSnapshotUpload();
          }}
        >
          <FormGroup
            label="Snapshot File"
            isRequired
            fieldId="snapshot-file"
            labelHelp={
              <Popover
                headerContent="Snapshot File"
                bodyContent={`An etcd snapshot file created with "etcdctl snapshot save" or "etcdutl snapshot save". The file is a BoltDB database containing all etcd data at the time of the snapshot. Maximum file size: ${(snapshotMaxSize / (1024 * 1024 * 1024)).toFixed(1)} GB.`}
              >
                <FormGroupLabelHelp aria-label="More info for snapshot file field" />
              </Popover>
            }
          >
            {snapshotFile ? (
              <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
                <FlexItem>
                  <Label icon={<DatabaseIcon />} color="blue">{snapshotFile.name}</Label>
                </FlexItem>
                <FlexItem>
                  <Label isCompact>{formatSize(snapshotFile.size)}</Label>
                </FlexItem>
                <FlexItem>
                  <Button variant="link" isInline onClick={() => { setSnapshotFile(null); setSnapshotError(null); }}>
                    Change file
                  </Button>
                </FlexItem>
              </Flex>
            ) : (
              <MultipleFileUpload
                onFileDrop={handleSnapshotDrop}
                dropzoneProps={{ accept: { 'application/octet-stream': ['.db', '.snap', '.backup'] }, multiple: false }}
              >
                <MultipleFileUploadMain
                  titleIcon={<UploadIcon />}
                  titleText="Drag and drop a snapshot file here"
                  titleTextSeparator="or"
                  browseButtonText="Browse"
                  infoText="Accepted file types: .db, .snap, .backup"
                />
              </MultipleFileUpload>
            )}
            <HelperText>
              <HelperTextItem>
                Upload an etcd snapshot file (created with etcdctl snapshot save). Max size: {(snapshotMaxSize / (1024 * 1024 * 1024)).toFixed(1)} GB.
              </HelperTextItem>
            </HelperText>
          </FormGroup>

          {snapshotUploading && (
            <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
              <FlexItem><Spinner size="md" /></FlexItem>
              <FlexItem>Uploading and restoring snapshot...</FlexItem>
            </Flex>
          )}

          {snapshotError && (
            <Alert
              variant="danger"
              isInline
              isPlain
              title={snapshotError}
              actionClose={<AlertActionCloseButton onClose={() => setSnapshotError(null)} />}
            />
          )}

          <ActionGroup>
            <Button
              variant="primary"
              type="submit"
              isLoading={snapshotUploading}
              isDisabled={snapshotUploading || !snapshotFile}
              icon={<UploadIcon />}
            >
              Load Snapshot
            </Button>
          </ActionGroup>
        </Form>
    </div>
  );

  const browserPanel = (
    <div className="etcd-browser">
      {error && (
        <div style={{ flexShrink: 0, marginBottom: 'var(--pf-t--global--spacer--sm)' }}>
          <Alert
            variant="danger"
            title={error}
            actionClose={<AlertActionCloseButton onClose={() => setError(null)} />}
          />
        </div>
      )}

      <div className="etcd-browser__columns">
        <div className="etcd-col etcd-col--keys">
          <Card>
            <CardTitle>Key Browser</CardTitle>
            <CardBody>
              {treeToolbar}
              {loading ? (
                <Flex justifyContent={{ default: 'justifyContentCenter' }}>
                  <Spinner size="lg" />
                </Flex>
              ) : displayData.length === 0 ? (
                <EmptyState headingLevel="h4" icon={DatabaseIcon} titleText="No keys found">
                  <EmptyStateBody>
                    {filterText
                      ? 'No keys match your filter.'
                      : 'The etcd cluster appears to be empty.'}
                  </EmptyStateBody>
                </EmptyState>
              ) : (
                <TreeView
                  data={displayData}
                  activeItems={activeItems}
                  onSelect={handleSelect}
                  onExpand={handleExpand}
                  hasSelectableNodes
                  hasGuides
                  aria-label="etcd key tree"
                />
              )}
            </CardBody>
          </Card>
        </div>

        <div className="etcd-col etcd-col--value">
          <Card>
            <CardTitle>
              {selectedKey ? (
                <Flex gap={{ default: 'gapSm' }} alignItems={{ default: 'alignItemsCenter' }}>
                  <FlexItem>Value</FlexItem>
                  <FlexItem><Label isCompact>{selectedKey}</Label></FlexItem>
                </Flex>
              ) : (
                'Value'
              )}
            </CardTitle>
            <CardBody>
              {valueLoading ? (
                <Flex justifyContent={{ default: 'justifyContentCenter' }}>
                  <Spinner size="lg" />
                </Flex>
              ) : selectedResult ? (
                <ValueDisplay result={selectedResult} />
              ) : (
                <EmptyState headingLevel="h4" icon={KeyIcon} titleText="Select a key">
                  <EmptyStateBody>
                    Click on a key in the tree to view its value.
                  </EmptyStateBody>
                </EmptyState>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );

  return (
    <ThemeContext.Provider value={effectiveTheme}>
    <Page
      masthead={
        <Masthead>
          <MastheadMain>
            <MastheadBrand>
              <div className="etcd-masthead-brand">
                <img src={etcdLogoUrl} alt="etcd" style={{ height: '32px', width: '32px' }} />
                <Title headingLevel="h1" size="xl" className="etcd-masthead-brand__title">
                  etcd v3 Browser
                </Title>
              </div>
            </MastheadBrand>
          </MastheadMain>
          <MastheadContent>
            <div className="etcd-masthead-content">
              <div className="etcd-masthead-content__status">
                {connection ? (
                  <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
                    <FlexItem>
                      <Label color="green" icon={snapshotName ? <DatabaseIcon /> : <PluggedIcon />}>
                        {snapshotName || connection.endpoint}
                      </Label>
                    </FlexItem>
                    {snapshotName && (
                      <FlexItem>
                        <Label isCompact color="blue">Snapshot</Label>
                      </FlexItem>
                    )}
                    <FlexItem>
                      <Label isCompact>Version {connection.version}</Label>
                    </FlexItem>
                    <FlexItem>
                      <Button
                        variant="plain"
                        aria-label="Disconnect"
                        onClick={handleDisconnect}
                        style={{ color: 'var(--pf-t--global--color--inverse--100)' }}
                        icon={<TimesIcon />}
                      />
                    </FlexItem>
                  </Flex>
                ) : (
                  <Label color="grey" icon={<UnpluggedIcon />}>Not connected</Label>
                )}
              </div>
              <div>
                <Dropdown
                  isOpen={settingsOpen}
                  onSelect={() => setSettingsOpen(false)}
                  onOpenChange={setSettingsOpen}
                  toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                    <Tooltip content="Settings">
                      <MenuToggle
                        ref={toggleRef}
                        variant="plain"
                        onClick={() => setSettingsOpen(!settingsOpen)}
                        isExpanded={settingsOpen}
                        style={{ color: 'var(--pf-t--global--color--inverse--100)' }}
                      >
                        <CogIcon />
                      </MenuToggle>
                    </Tooltip>
                  )}
                  popperProps={{ position: 'right' }}
                >
                  <DropdownList>
                    {(['light', 'dark', 'auto'] as ThemeChoice[]).map((t) => (
                      <DropdownItem
                        key={t}
                        icon={THEME_LABELS[t].icon}
                        isSelected={themeChoice === t}
                        onClick={() => setThemeChoice(t)}
                      >
                        {THEME_LABELS[t].label}
                      </DropdownItem>
                    ))}
                  </DropdownList>
                </Dropdown>
              </div>
            </div>
          </MastheadContent>
        </Masthead>
      }
    >
      <PageSection className="etcd-main-section">
        {connection ? browserPanel : (
          <Card>
            <CardBody>
              <ToggleGroup aria-label="Connection mode" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                <ToggleGroupItem
                  text="Connect to etcd"
                  buttonId="mode-connect"
                  isSelected={connectionMode === 'connect'}
                  onChange={() => setConnectionMode('connect')}
                />
                <ToggleGroupItem
                  text="Load Snapshot"
                  buttonId="mode-snapshot"
                  isSelected={connectionMode === 'snapshot'}
                  onChange={() => setConnectionMode('snapshot')}
                />
              </ToggleGroup>
              <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {connectionMode === 'connect' ? connectionForm : snapshotForm}
              </div>
            </CardBody>
          </Card>
        )}
      </PageSection>
      <div className="etcd-disclaimer">
        {DISCLAIMER_TEXT}
      </div>
    </Page>
    </ThemeContext.Provider>
  );
}

export default App;
