'use client';

import { motion } from 'motion/react';
import {
  AlertTriangle,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  Key,
  KeyRound,
  Lock,
  MessageSquare,
  Phone,
  Plug,
  QrCode,
  RefreshCw,
  Search,
  Server,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Unplug,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  AI_PROVIDERS,
  PLATFORM_RULES,
  PLATFORMS,
  type ChannelDto,
  type Platform,
  type UserDto,
  type WhatsAppStatusDto,
} from '@mehwar/shared';
import { FadeIn, Stagger, StaggerItem } from '@/components/motion';
import { Avatar, Button, Card, Input, Modal, Switch, Wordmark } from '@/components/ui';
import { api, ApiError, downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { invalidate, useApi } from '@/lib/hooks';
import { formatBytes } from '@/lib/media';
import { PlatformIcon, PLATFORM_BRAND } from '@/lib/platforms';
import { WhatsAppModal } from '@/components/modals/WhatsAppModal';



interface BillingOverview {
  billingEnabled: boolean;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  limits: {
    label: string;
    channels: number;
    scheduledPosts: number;
    storageBytes: number;
    aiCreditsPerMonth: number;
  };
  usage: {
    channels: number;
    scheduledPosts: number;
    storageBytes: number;
    aiCreditsPerMonth: number;
  };
  plans: {
    id: 'pro' | 'business';
    label: string;
    priceUsd: number;
    channels: number;
    scheduledPosts: number;
    aiCreditsPerMonth: number;
  }[];
}

function UsageBar({
  label,
  used,
  limit,
  format = (n: number) => n.toLocaleString(),
}: {
  label: string;
  used: number;
  limit: number;
  format?: (n: number) => string;
}) {
  const unlimited = limit >= Number.MAX_SAFE_INTEGER / 2;
  const ratio = unlimited ? 0 : Math.min(1, used / Math.max(limit, 1));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted">
          {format(used)} {unlimited ? '' : `/ ${format(limit)}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-line">
        <motion.div
          className={cn('h-full rounded-full', ratio > 0.9 ? 'bg-red-500' : 'brand-gradient')}
          initial={{ width: 0 }}
          animate={{ width: unlimited ? '4%' : `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

function BillingSection() {
  const { data } = useApi<BillingOverview>('/billing', ['billing', 'channels', 'posts', 'media']);
  const [busy, setBusy] = useState<string | null>(null);
  const go = async (path: string, json?: object) => {
    setBusy(path);
    try {
      const { url } = await api<{ url: string }>(path, { method: 'POST', json });
      window.location.href = url;
    } catch (err) {
      toast.error((err as ApiError).message);
      setBusy(null);
    }
  };
  const gb = (n: number) => formatBytes(n);
  if (!data) return null;
  return (
    <Card className="space-y-4 bg-card-strong p-6" id="billing">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-500 dark:text-fuchsia-400">
            <CreditCard className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Plan & usage</h2>
            <p className="text-xs text-muted">
              {data.limits.label}
              {data.currentPeriodEnd
                ? ` · renews ${new Date(data.currentPeriodEnd).toLocaleDateString()}`
                : ''}
              {data.status !== 'active' ? ` · ${data.status}` : ''}
            </p>
          </div>
        </div>
        {data.billingEnabled && data.plan !== 'free' && (
          <Button
            size="sm"
            variant="secondary"
            loading={busy === '/billing/portal'}
            onClick={() => go('/billing/portal')}
          >
            Manage billing
          </Button>
        )}
      </div>
      <div className="space-y-3">
        <UsageBar label="Channels" used={data.usage.channels} limit={data.limits.channels} />
        <UsageBar
          label="Scheduled posts"
          used={data.usage.scheduledPosts}
          limit={data.limits.scheduledPosts}
        />
        <UsageBar
          label="Media storage"
          used={data.usage.storageBytes}
          limit={data.limits.storageBytes}
          format={gb}
        />
        <UsageBar
          label="AI credits this month"
          used={data.usage.aiCreditsPerMonth}
          limit={data.limits.aiCreditsPerMonth}
        />
      </div>
      {data.billingEnabled && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.plans.map((p) => (
            <motion.div
              key={p.id}
              whileHover={{ y: -3 }}
              className={cn(
                'rounded-2xl border p-4',
                data.plan === p.id ? 'border-fuchsia-500' : 'border-line',
              )}
            >
              <p className="font-bold">{p.label}</p>
              <p className="text-2xl font-black">
                ${p.priceUsd}
                <span className="text-sm font-medium text-muted">/mo</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {p.channels} channels · {p.scheduledPosts.toLocaleString()} scheduled posts ·{' '}
                {p.aiCreditsPerMonth.toLocaleString()} AI credits
              </p>
              <Button
                size="sm"
                className="mt-3 w-full"
                disabled={data.plan === p.id}
                loading={busy === `/billing/checkout:${p.id}`}
                onClick={() => {
                  setBusy(`/billing/checkout:${p.id}`);
                  void go('/billing/checkout', { plan: p.id });
                }}
              >
                {data.plan === p.id ? 'Current plan' : `Upgrade to ${p.label}`}
              </Button>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  );
}



function AiSettingsSection() {
  const { data: initialSettings, setData } = useApi<{
    aiProvider: string | null;
    aiBaseUrl: string | null;
    aiModel: string | null;
    aiDefaultModel: string | null;
    hasAiApiKey: boolean;
    aiApiKeyMasked: string | null;
    isEnvDefaultKey?: boolean;
  }>('/ai/settings', ['ai']);

  const defaultMeta = AI_PROVIDERS.nvidia || Object.values(AI_PROVIDERS)[0];
  const [provider, setProvider] = useState<string>('nvidia');
  const [baseUrl, setBaseUrl] = useState<string>(defaultMeta.defaultBaseUrl);
  const [model, setModel] = useState<string>(defaultMeta.defaultModel);
  const [defaultModel, setDefaultModel] = useState<string>(defaultMeta.defaultModel);
  const [apiKey, setApiKey] = useState<string>('');
  const [isReplacingKey, setIsReplacingKey] = useState<boolean>(false);
  const [customModelMode, setCustomModelMode] = useState<boolean>(false);
  const [customModelInput, setCustomModelInput] = useState<string>('');
  const [showKeyText, setShowKeyText] = useState<boolean>(false);

  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (initialSettings) {
      const p = initialSettings.aiProvider || 'nvidia';
      const meta = AI_PROVIDERS[p] || AI_PROVIDERS.nvidia || Object.values(AI_PROVIDERS)[0];
      setProvider(p);
      setBaseUrl(initialSettings.aiBaseUrl || meta.defaultBaseUrl);
      const m = initialSettings.aiModel || meta.defaultModel;
      setModel(m);
      setDefaultModel(initialSettings.aiDefaultModel || m || meta.defaultModel);
      if (m && !meta.models.includes(m)) {
        setCustomModelMode(true);
        setCustomModelInput(m);
      }
    }
  }, [initialSettings]);

  const activeProviderMeta = AI_PROVIDERS[provider] || AI_PROVIDERS.nvidia || Object.values(AI_PROVIDERS)[0];

  function handleSelectProvider(pId: string) {
    const meta = AI_PROVIDERS[pId] || AI_PROVIDERS.nvidia || Object.values(AI_PROVIDERS)[0];
    setProvider(pId);
    setBaseUrl(meta.defaultBaseUrl);
    setModel(meta.defaultModel);
    setDefaultModel(meta.defaultModel);
    setCustomModelMode(false);
    setCustomModelInput('');
    setTestResult(null);
    toast.info(`Selected ${meta.name}`, {
      description: `Base URL automatically set to ${meta.defaultBaseUrl}`,
    });
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    const effectiveModel = customModelMode && customModelInput.trim() ? customModelInput.trim() : model;
    try {
      const res = await api<{ success: boolean; message?: string; error?: string }>(
        '/ai/test-connection',
        {
          method: 'POST',
          json: {
            provider,
            baseUrl,
            apiKey: apiKey.trim() || undefined,
            model: defaultModel || effectiveModel,
          },
        },
      );
      setTestResult(res);
      if (res.success) {
        toast.success('Connection test succeeded!', { description: res.message });
      } else {
        toast.error('Connection test failed', { description: res.error });
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Connection test failed';
      setTestResult({ success: false, error: msg });
      toast.error('Connection test failed', { description: msg });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const effectiveModel = customModelMode && customModelInput.trim() ? customModelInput.trim() : model;
    const effectiveDefaultModel = defaultModel || effectiveModel;
    try {
      const updated = await api<{
        aiProvider: string;
        aiBaseUrl: string;
        aiModel: string;
        aiDefaultModel: string;
        hasAiApiKey: boolean;
        aiApiKeyMasked: string | null;
        isEnvDefaultKey?: boolean;
      }>('/ai/settings', {
        method: 'POST',
        json: {
          provider,
          baseUrl,
          model: effectiveModel,
          defaultModel: effectiveDefaultModel,
          apiKey: apiKey.trim().length > 0 ? apiKey.trim() : undefined,
        },
      });

      setApiKey('');
      setIsReplacingKey(false);
      setData(updated);
      invalidate('ai');
      toast.success('AI Settings saved successfully! ✨', {
        description: `Active model: ${updated.aiDefaultModel} (${updated.aiProvider})`,
      });
    } catch (err) {
      toast.error('Could not save AI settings', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveKey() {
    if (!confirm('Are you sure you want to remove your saved AI API key?')) return;
    setSaving(true);
    try {
      const updated = await api('/ai/settings', {
        method: 'POST',
        json: { apiKey: '' },
      });
      setIsReplacingKey(false);
      setApiKey('');
      setData(updated as any);
      invalidate('ai');
      toast.success('API Key removed');
    } catch (err) {
      toast.error('Could not remove key');
    } finally {
      setSaving(false);
    }
  }

  const hasSavedKey = initialSettings?.hasAiApiKey ?? false;

  return (
    <Card className="space-y-6 bg-card-strong p-6" id="ai-settings">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-500 dark:text-fuchsia-400">
            <Sparkles className="size-6" />
          </span>
          <div>
            <h2 className="text-xl font-bold tracking-tight">AI & LLM Configuration</h2>
            <p className="text-xs text-muted">
              Choose your LLM provider, enter your API key, customize base endpoints, and select your default model.
            </p>
          </div>
        </div>
        {hasSavedKey && (
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border',
              initialSettings?.isEnvDefaultKey
                ? 'bg-sky-500/15 text-sky-400 border-sky-500/20'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
            )}
          >
            <ShieldCheck className="size-3.5" />
            {initialSettings?.isEnvDefaultKey ? 'System Default Key Active' : 'Key Saved'}
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Step 1: Provider Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">
              1. Select LLM Provider
            </label>
            <span className="text-[11px] text-muted">Auto-populates endpoint and recommended models</span>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {Object.values(AI_PROVIDERS).map((p) => {
              const selected = provider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProvider(p.id)}
                  className={cn(
                    'relative flex flex-col items-start justify-between rounded-2xl border p-3.5 text-left transition-all',
                    selected
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
                      : 'border-line bg-elevated/40 hover:border-line/80 hover:bg-elevated/70',
                  )}
                >
                  <div className="w-full">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-bold text-fg">{p.name}</span>
                      {selected && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-muted line-clamp-2 leading-tight">
                      {p.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Base URL (Auto-filled) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Server className="size-3.5" /> 2. Base Endpoint URL (Auto-Filled)
            </label>
            {baseUrl !== activeProviderMeta.defaultBaseUrl && (
              <button
                type="button"
                onClick={() => setBaseUrl(activeProviderMeta.defaultBaseUrl)}
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                <RefreshCw className="size-3" /> Reset to default ({activeProviderMeta.defaultBaseUrl})
              </button>
            )}
          </div>
          <Input
            label="Endpoint Base URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted">
            Requests are dispatched to this endpoint. Supports standard OpenAI-compatible proxies and direct provider URLs.
          </p>
        </div>

        {/* Step 3: Model Selection & Default Model */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Available Models */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Cpu className="size-3.5" /> 3. Select Model
              </label>
              <button
                type="button"
                onClick={() => setCustomModelMode(!customModelMode)}
                className="text-[11px] text-primary hover:underline"
              >
                {customModelMode ? 'Choose from list' : '+ Custom model'}
              </button>
            </div>

            {customModelMode ? (
              <Input
                label="Custom Model Name"
                value={customModelInput}
                onChange={(e) => {
                  setCustomModelInput(e.target.value);
                  setDefaultModel(e.target.value);
                }}
                placeholder="e.g. meta-llama/llama-3-8b, my-fine-tune"
                className="font-mono text-xs"
              />
            ) : (
              <select
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setDefaultModel(e.target.value);
                }}
                className="w-full rounded-2xl border border-line bg-elevated/60 px-3.5 py-2.5 text-sm text-fg outline-none focus:ring-4 focus:ring-[var(--ring)]"
              >
                {activeProviderMeta.models.map((m) => (
                  <option key={m} value={m} className="bg-card text-fg">
                    {m} {m === activeProviderMeta.defaultModel ? '(Recommended)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Default Model Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Bot className="size-3.5" /> 4. Default Model to Use
            </label>
            <div className="flex h-11 items-center gap-2 rounded-2xl border border-line bg-elevated/40 px-3.5">
              <span className="text-xs font-bold text-fg truncate">
                {customModelMode && customModelInput.trim() ? customModelInput.trim() : defaultModel || model}
              </span>
              <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                Active Default
              </span>
            </div>
            <p className="text-[11px] text-muted">
              Used automatically for captions, hashtags, viral hooks, and comment analysis.
            </p>
          </div>
        </div>

        {/* Step 4: API Key */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Key className="size-3.5" /> 5. API Key
          </label>

          {hasSavedKey && !isReplacingKey ? (
            initialSettings?.isEnvDefaultKey && provider === 'nvidia' ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
                    <ShieldCheck className="size-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-fg">Default NVIDIA Key Active (from .env)</p>
                      <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                        System Default
                      </span>
                    </div>
                    <p className="text-xs font-mono text-muted mt-0.5">
                      {initialSettings?.aiApiKeyMasked || 'nvapi...••••'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => setIsReplacingKey(true)}
                    className="h-8 text-xs"
                  >
                    Custom Key Override
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                    <ShieldCheck className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-fg">API Key Securely Encrypted & Saved</p>
                    <p className="text-xs font-mono text-muted">
                      {initialSettings?.aiApiKeyMasked || '••••••••••••••••'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => setIsReplacingKey(true)}
                    className="h-8 text-xs"
                  >
                    Replace Key
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={handleRemoveKey}
                    className="h-8 text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Input
                  label="API Key"
                  type={showKeyText ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={activeProviderMeta.keyPlaceholder}
                  icon={<Key className="size-4" />}
                  className="font-mono text-xs pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKeyText(!showKeyText)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
                  title={showKeyText ? 'Hide key' : 'Show key'}
                >
                  {showKeyText ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>
                  {provider === 'ollama'
                    ? 'Ollama runs locally; API key is optional.'
                    : 'Encrypted at rest in PostgreSQL with envelope encryption. Never shown in plaintext again.'}
                </span>
                {hasSavedKey && isReplacingKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsReplacingKey(false);
                      setApiKey('');
                    }}
                    className="text-primary hover:underline font-semibold"
                  >
                    Keep existing key
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Test Result Callout */}
        {testResult && (
          <div
            className={cn(
              'flex items-start gap-3 rounded-2xl p-4 border text-xs leading-relaxed',
              testResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300',
            )}
          >
            {testResult.success ? (
              <CheckCircle2 className="size-4 text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-red-400 mt-0.5 shrink-0" />
            )}
            <div>
              <p className="font-bold text-fg">
                {testResult.success ? 'Connection Successful' : 'Connection Failed'}
              </p>
              <p className="mt-0.5">{testResult.message || testResult.error}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <Button
            type="button"
            variant="secondary"
            loading={testing}
            onClick={handleTestConnection}
            className="gap-2"
          >
            <RefreshCw className="size-3.5" /> Test Connection
          </Button>

          <Button type="submit" loading={saving} className="gap-2">
            <Check className="size-4" /> Save AI Settings
          </Button>
        </div>
      </form>
    </Card>
  );
}

type SettingsTab = 'networks' | 'whatsapp' | 'ai' | 'billing';

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: any; description: string }[] = [
  {
    id: 'networks',
    label: 'Social Networks',
    icon: Share2,
    description: 'Manage connected social media channels and add new networks',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageSquare,
    description: 'Connect WhatsApp session, pair QR code, and manage customer dispatch attributes',
  },
  {
    id: 'ai',
    label: 'AI & LLM Setup',
    icon: Sparkles,
    description: 'Configure your LLM provider, API key, endpoint, and default model',
  },
  {
    id: 'billing',
    label: 'Plan & Billing',
    icon: CreditCard,
    description: 'Subscription plans, resource limits and usage metrics',
  },
];

const NETWORK_NOTES: Record<string, string> = {
  youtube: 'Connect your Google account to publish videos and manage comments.',
  facebook: 'Connect your Facebook Pages to publish posts and view page insights.',
  instagram: 'Needs a Business or Creator account linked to a Facebook Page.',
  x: 'Publish tweets, threads and media directly to your X account.',
  linkedin: 'Publish updates and articles to your LinkedIn profile or pages.',
  tiktok: 'Upload videos directly to your TikTok account.',
  threads: 'Share text and media updates to your Threads profile.',
  pinterest: 'Create and publish pins directly to your Pinterest boards.',
  snapchat: 'Publishing requires Snapchat partner access.',
  whatsapp: 'Pair via QR code or configure in Settings to dispatch updates directly to customers.',
};

interface PlatformSetupInfo {
  title: string;
  portalUrl: string;
  portalName: string;
  envVars: string[];
  redirectPath: string;
  requiredScopesOrProducts: string[];
  steps: string[];
  notes?: string;
}

const PLATFORM_SETUP_GUIDES: Record<Platform, PlatformSetupInfo> = {
  linkedin: {
    title: 'LinkedIn App Setup Guide',
    portalUrl: 'https://www.linkedin.com/developers/apps',
    portalName: 'LinkedIn Developer Portal',
    envVars: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
    redirectPath: '/api/channels/callback/linkedin',
    requiredScopesOrProducts: [
      'Share on LinkedIn (Product: allows publishing updates via w_member_social)',
      'Sign In with LinkedIn using OpenID Connect (Product: scopes openid, profile, email)',
    ],
    steps: [
      'Go to the LinkedIn Developer Portal and click "Create App".',
      'Provide your App Name, associate your LinkedIn Page (company/brand), and upload an app logo.',
      'Navigate to the "Products" tab and request access to "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect".',
      'Navigate to the "Auth" tab, expand "OAuth 2.0 settings", and add your Authorized Redirect URL shown below.',
      'Copy the Client ID and Primary Client Secret, and paste them into your .env file.',
      'Restart the API and Worker dev processes to load the new credentials.',
    ],
    notes:
      'Both personal member profiles and organization company pages (where you have Administrator access) can be connected once authorized.',
  },
  youtube: {
    title: 'Google & YouTube API Setup Guide',
    portalUrl: 'https://console.cloud.google.com/apis/credentials',
    portalName: 'Google Cloud Console',
    envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    redirectPath: '/api/channels/callback/youtube',
    requiredScopesOrProducts: [
      'YouTube Data API v3',
      'Scope: https://www.googleapis.com/auth/youtube.upload',
      'Scope: https://www.googleapis.com/auth/youtube.force-ssl',
    ],
    steps: [
      'Create or select a project in Google Cloud Console.',
      'Go to APIs & Services → Library and enable the "YouTube Data API v3".',
      'Configure the OAuth Consent Screen (set User Type to External, add scopes).',
      'Go to Credentials → Create Credentials → OAuth Client ID (Web Application).',
      'Add the Authorized Redirect URI shown below.',
      'Copy the Client ID and Client Secret into .env as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
    ],
    notes: 'Uploads will remain private until Google verifies the app or you add test users in Google Cloud Console.',
  },
  facebook: {
    title: 'Meta Facebook Pages Setup Guide',
    portalUrl: 'https://developers.facebook.com/apps',
    portalName: 'Meta for Developers',
    envVars: ['META_CLIENT_ID', 'META_CLIENT_SECRET'],
    redirectPath: '/api/channels/callback/facebook',
    requiredScopesOrProducts: [
      'Facebook Login for Business',
      'Permissions: pages_show_list, pages_manage_posts, pages_read_engagement, business_management',
    ],
    steps: [
      'Go to Meta for Developers and create an App of type "Business".',
      'Add the "Facebook Login for Business" product to your app.',
      'In Facebook Login → Settings, add the Authorized Redirect URI below.',
      'Copy the App ID and App Secret from Settings → Basic into .env as META_CLIENT_ID and META_CLIENT_SECRET.',
    ],
    notes: 'You can choose which Facebook Pages to publish to during authorization.',
  },
  instagram: {
    title: 'Instagram Professional Setup Guide',
    portalUrl: 'https://developers.facebook.com/apps',
    portalName: 'Meta for Developers',
    envVars: ['META_CLIENT_ID', 'META_CLIENT_SECRET'],
    redirectPath: '/api/channels/callback/instagram',
    requiredScopesOrProducts: [
      'Instagram Graph API',
      'Permissions: instagram_basic, instagram_content_publish, instagram_manage_comments, instagram_manage_insights',
    ],
    steps: [
      'Uses the same Meta Business App credentials as Facebook (META_CLIENT_ID & META_CLIENT_SECRET).',
      'Ensure your Instagram account is a Business or Creator account connected to a Facebook Page you manage.',
      'Add the Instagram callback redirect URI to Facebook Login settings.',
      'Authenticate with Facebook to discover linked Instagram professional accounts.',
    ],
    notes:
      'Instagram personal accounts are not supported by Meta Graph API; an Instagram Professional account linked to a Page is required.',
  },
  x: {
    title: 'X (Twitter) Developer App Setup Guide',
    portalUrl: 'https://developer.x.com/en/portal/dashboard',
    portalName: 'X Developer Portal',
    envVars: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
    redirectPath: '/api/channels/callback/x',
    requiredScopesOrProducts: [
      'OAuth 2.0 with PKCE',
      'Scopes: tweet.read, tweet.write, users.read, media.write, offline.access',
    ],
    steps: [
      'Create a Project and App in the X Developer Portal.',
      'Open User Authentication Settings: select "OAuth 2.0", set App Type to "Web App".',
      'Set App Permissions to "Read and write".',
      'Add the Callback URL shown below.',
      'Copy OAuth 2.0 Client ID and Client Secret into .env as X_CLIENT_ID and X_CLIENT_SECRET.',
    ],
    notes: 'Posting tweets via the X API requires a Basic or Pro developer plan.',
  },
  threads: {
    title: 'Threads API Setup Guide',
    portalUrl: 'https://developers.facebook.com/apps',
    portalName: 'Meta for Developers',
    envVars: ['THREADS_CLIENT_ID', 'THREADS_CLIENT_SECRET'],
    redirectPath: '/api/channels/callback/threads',
    requiredScopesOrProducts: [
      'Threads API use case',
      'Scopes: threads_basic, threads_content_publish, threads_manage_insights',
    ],
    steps: [
      'Create a Meta App with the "Threads API" use case.',
      'Configure the Authorized Redirect URI in Threads API settings.',
      'Copy the App ID and App Secret into .env as THREADS_CLIENT_ID and THREADS_CLIENT_SECRET.',
    ],
  },
  tiktok: {
    title: 'TikTok Content Posting API Setup Guide',
    portalUrl: 'https://developers.tiktok.com',
    portalName: 'TikTok for Developers',
    envVars: ['TIKTOK_CLIENT_ID', 'TIKTOK_CLIENT_SECRET'],
    redirectPath: '/api/channels/callback/tiktok',
    requiredScopesOrProducts: [
      'Content Posting API',
      'Scopes: user.info.basic, video.publish, video.upload',
    ],
    steps: [
      'Create an App on the TikTok Developer Portal.',
      'Add the Content Posting API product.',
      'Add the Redirect URI in your TikTok app configuration.',
      'Copy Client Key and Client Secret into .env as TIKTOK_CLIENT_ID and TIKTOK_CLIENT_SECRET.',
    ],
    notes: 'Until the TikTok app completes review and verification, posts are published in private mode (SELF_ONLY).',
  },
  snapchat: {
    title: 'Snapchat Snap Kit Setup Guide',
    portalUrl: 'https://kit.snapchat.com',
    portalName: 'Snap Kit Portal',
    envVars: ['SNAPCHAT_CLIENT_ID', 'SNAPCHAT_CLIENT_SECRET', 'FEATURE_SNAPCHAT=true'],
    redirectPath: '/api/channels/callback/snapchat',
    requiredScopesOrProducts: ['Snap Kit / Public Profile Partner Access'],
    steps: [
      'Create an App in Snap Kit.',
      'Add the Redirect URI below.',
      'Copy credentials into .env as SNAPCHAT_CLIENT_ID and SNAPCHAT_CLIENT_SECRET.',
      'Ensure FEATURE_SNAPCHAT=true is set in .env.',
    ],
    notes: 'Publishing requires Snapchat partner-level access.',
  },
  whatsapp: {
    title: 'WhatsApp Web Pairing Guide',
    portalUrl: 'https://web.whatsapp.com',
    portalName: 'WhatsApp Web',
    envVars: [],
    redirectPath: '/settings#whatsapp',
    requiredScopesOrProducts: [
      'WhatsApp Multi-Device Web Client',
      'Automated customer media & message dispatch',
    ],
    steps: [
      'Click "Start QR Scan" below or open Settings → WhatsApp tab.',
      'Open WhatsApp on your mobile phone.',
      'Tap Settings (iOS) or ⋮ Menu (Android) → Linked Devices.',
      'Tap "Link a Device" and scan the displayed QR code with your phone camera.',
      'Once linked, your WhatsApp session is saved and automatically appears in your Channels list.',
    ],
    notes:
      'No Meta developer account or API token is required for WhatsApp Web QR pairing. Your session remains linked for automated delivery and customer sharing.',
  },
};

function NetworkSetupModal({
  platform,
  isConfigured,
  onClose,
  onConnect,
  connecting,
}: {
  platform: Platform;
  isConfigured: boolean;
  onClose: () => void;
  onConnect: (p: Platform) => void;
  connecting: boolean;
}) {
  const guide = PLATFORM_SETUP_GUIDES[platform];
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  const requiresHttps =
    platform === 'threads' ||
    platform === 'facebook' ||
    platform === 'instagram' ||
    platform === 'tiktok';

  const [useHttps, setUseHttps] = useState(
    requiresHttps || (typeof window !== 'undefined' && window.location.protocol === 'https:'),
  );

  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
  const redirectUrl = `${useHttps ? 'https:' : 'http:'}//${host}${guide.redirectPath}`;

  const envSnippet = guide.envVars
    .map((v) => (v.includes('=') ? v : `${v}=your_${v.toLowerCase()}_here`))
    .join('\n');

  function copyRedirectUrl() {
    navigator.clipboard.writeText(redirectUrl);
    setCopiedUrl(true);
    toast.success('Redirect URI copied to clipboard!');
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  function copyEnvSnippet() {
    navigator.clipboard.writeText(envSnippet);
    setCopiedEnv(true);
    toast.success('Environment variables copied to clipboard!');
    setTimeout(() => setCopiedEnv(false), 2000);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${PLATFORM_RULES[platform].label} Integration Setup`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 pt-1 max-h-[75vh] overflow-y-auto pr-1">
        {/* Status Callout */}
        <div
          className={cn(
            'flex items-start gap-3 rounded-2xl p-4 border text-sm',
            isConfigured
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300',
          )}
        >
          <div className="mt-0.5 shrink-0">
            {isConfigured ? (
              <Check className="size-5 text-emerald-400" />
            ) : (
              <Info className="size-5 text-amber-400" />
            )}
          </div>
          <div>
            <p className="font-bold text-fg">
              {isConfigured
                ? `${PLATFORM_RULES[platform].label} is configured & ready!`
                : `Configuration required for ${PLATFORM_RULES[platform].label}`}
            </p>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              {isConfigured
                ? 'Your environment variables are detected. You can connect your channel immediately.'
                : 'Follow the steps below to create your developer app, configure the redirect URI, and add credentials to your .env file.'}
            </p>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Setup Instructions</h4>
          <ol className="space-y-2.5 text-sm">
            {guide.steps.map((s, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-line text-[11px] font-bold text-fg mt-0.5">
                  {idx + 1}
                </span>
                <span className="leading-snug text-fg/90">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        {platform === 'whatsapp' ? (
          <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <QrCode className="size-4" />
              <span>Direct WhatsApp Web QR Pairing</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              No developer credentials, OAuth client secrets, or webhook configuration needed. You can pair your WhatsApp account directly using our built-in QR code scanner or adjust WhatsApp session settings at any time.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                onClick={() => {
                  onClose();
                  onConnect('whatsapp');
                }}
              >
                <QrCode className="size-3.5" /> Start QR Pairing Now
              </Button>
              <Link href="/settings?tab=whatsapp" onClick={onClose}>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Settings className="size-3.5" /> Go to WhatsApp Settings
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Redirect URI Box */}
            <div className="space-y-2 rounded-2xl border border-line bg-elevated/60 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-fg">Authorized Redirect URI</span>
                  <div className="flex items-center rounded-lg bg-card p-0.5 border border-line text-[11px]">
                    <button
                      type="button"
                      onClick={() => setUseHttps(false)}
                      className={cn(
                        'px-2 py-0.5 rounded-md font-medium transition cursor-pointer',
                        !useHttps ? 'bg-primary text-white' : 'text-muted hover:text-fg',
                      )}
                    >
                      HTTP
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseHttps(true)}
                      className={cn(
                        'px-2 py-0.5 rounded-md font-medium transition cursor-pointer',
                        useHttps ? 'bg-primary text-white' : 'text-muted hover:text-fg',
                      )}
                    >
                      HTTPS
                    </button>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={copyRedirectUrl}>
                  {copiedUrl ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  {copiedUrl ? 'Copied' : 'Copy URI'}
                </Button>
              </div>
              <code className="block rounded-xl bg-card border border-line p-2.5 text-xs font-mono text-primary break-all select-all">
                {redirectUrl}
              </code>
              <p className="text-[11px] text-muted">
                {requiresHttps
                  ? '⚠️ Threads and Meta require HTTPS redirect URLs. Local development supports https://localhost:3000.'
                  : "Add this exact URL to your app's OAuth 2.0 Redirect URLs list in the developer portal."}
              </p>
            </div>

            {/* Required Products & Permissions */}
            <div className="space-y-2 rounded-2xl border border-line bg-elevated/60 p-4">
              <span className="text-xs font-bold text-fg">Required Products & Permissions</span>
              <ul className="mt-1 space-y-1.5 text-xs text-muted">
                {guide.requiredScopesOrProducts.map((p, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span className="text-fg/90">{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Environment Variables Snippet */}
            <div className="space-y-2 rounded-2xl border border-line bg-elevated/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-fg flex items-center gap-1.5">
                  <Terminal className="size-3.5 text-muted" />
                  <span>Add to .env</span>
                </span>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={copyEnvSnippet}>
                  {copiedEnv ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  {copiedEnv ? 'Copied' : 'Copy .env'}
                </Button>
              </div>
              <pre className="rounded-xl bg-card border border-line p-2.5 text-xs font-mono text-emerald-400 overflow-x-auto select-all">
                {envSnippet}
              </pre>
            </div>
          </>
        )}

        {guide.notes && (
          <p className="text-xs text-muted italic bg-line/20 p-3 rounded-xl border border-line/40">
            ℹ️ {guide.notes}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line">
          <a
            href={guide.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <span>Open {guide.portalName}</span>
            <ExternalLink className="size-3.5" />
          </a>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {isConfigured && (
              <Button
                variant="primary"
                loading={connecting}
                onClick={() => {
                  onClose();
                  onConnect(platform);
                }}
              >
                <Plug className="size-3.5" /> Connect {PLATFORM_RULES[platform].label} Now
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function NetworksSection() {
  const available = useApi<{ platform: Platform; configured: boolean }[]>('/channels/available');
  const channels = useApi<ChannelDto[]>('/channels', ['channels']);
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [removing, setRemoving] = useState<ChannelDto | null>(null);
  const [busyDisconnect, setBusyDisconnect] = useState(false);
  const [setupGuidePlatform, setSetupGuidePlatform] = useState<Platform | null>(null);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);

  async function connect(platform: Platform) {
    if (platform === 'whatsapp') {
      setWhatsappModalOpen(true);
      return;
    }
    setConnecting(platform);
    try {
      const { url } = await api<{ url: string }>(`/channels/connect/${platform}`, { method: 'POST' });
      window.location.href = url;
    } catch (err) {
      const e = err as ApiError;
      toast.error(
        e.body?.code === 'PLAN_LIMIT'
          ? 'Channel limit reached'
          : `Could not connect ${PLATFORM_RULES[platform].label}`,
        {
          description: e.message,
        },
      );
      setConnecting(null);
    }
  }

  async function disconnect() {
    if (!removing) return;
    setBusyDisconnect(true);
    try {
      await api(`/channels/${removing.id}`, { method: 'DELETE' });
      toast.success(`${removing.displayName} disconnected`);
      invalidate('channels', 'posts');
      setRemoving(null);
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setBusyDisconnect(false);
    }
  }

  const configured = new Map((available.data ?? []).map((a) => [a.platform, a.configured]));
  const connectedByPlatform = useMemo(() => {
    const map = new Map<Platform, ChannelDto[]>();
    for (const c of channels.data ?? []) {
      const existing = map.get(c.platform) ?? [];
      existing.push(c);
      map.set(c.platform, existing);
    }
    return map;
  }, [channels.data]);

  return (
    <div className="space-y-6" id="networks">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">Connected Social Networks</h2>
        <p className="text-xs text-muted">
          Connect your social media accounts to schedule, publish, and track analytics across platforms.
        </p>
      </div>

      {/* Integration Setup Guide Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-line bg-card/60">
        <div className="flex items-center gap-2.5">
          <BookOpen className="size-4 text-primary shrink-0" />
          <p className="text-xs text-muted">
            Need help configuring LinkedIn, YouTube, Meta, or other developer apps? Click <b className="text-fg">Setup Guide</b> on any network for redirect URIs, required products, and step-by-step instructions.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="text-xs shrink-0 h-8 gap-1.5"
          onClick={() => setSetupGuidePlatform('linkedin')}
        >
          <HelpCircle className="size-3.5 text-primary" />
          <span>LinkedIn Setup Guide</span>
        </Button>
      </div>

      <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const isConfigured = configured.get(p) ?? false;
          const isBusy = connecting === p;
          const connectedList = connectedByPlatform.get(p) ?? [];
          const hasConnected = connectedList.length > 0;

          return (
            <StaggerItem key={p}>
              <motion.div
                whileHover={isConfigured ? { y: -2 } : undefined}
                id={`platform-${p}`}
                className="h-full"
              >
                <div
                  className={cn(
                    'flex flex-col justify-between h-full rounded-3xl border p-5 bg-card-strong transition-all shadow-sm',
                    hasConnected
                      ? 'border-primary/40 ring-1 ring-primary/20'
                      : 'border-line hover:border-line/80',
                  )}
                >
                  <div className="space-y-4">
                    {/* Header: Platform Icon + Badge & Setup Guide Link */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
                          style={{ background: PLATFORM_BRAND[p].gradient }}
                        >
                          <PlatformIcon platform={p} className="size-6" />
                        </span>
                        <div>
                          <h3 className="font-bold text-base text-fg">{PLATFORM_RULES[p].label}</h3>
                          <p className="text-[11px] text-muted leading-tight mt-0.5">
                            {NETWORK_NOTES[p] ?? 'Connect account to publish.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {hasConnected ? (
                          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-500 border border-emerald-500/20">
                            {connectedList.length} Connected
                          </span>
                        ) : !isConfigured ? (
                          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-500">
                            Unavailable
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setSetupGuidePlatform(p)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-muted hover:text-fg transition px-2 py-0.5 rounded-lg border border-line/60 bg-elevated/40 hover:bg-line/60"
                          title={`View developer setup guide for ${PLATFORM_RULES[p].label}`}
                        >
                          <HelpCircle className="size-3 text-primary" />
                          <span>Setup Guide</span>
                        </button>
                      </div>
                    </div>

                    {/* Connected Accounts Card List */}
                    {hasConnected && (
                      <div className="space-y-2 pt-2 border-t border-line/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                          Connected Accounts
                        </span>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                          {connectedList.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-elevated/70 p-3 transition hover:border-line/90"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative shrink-0">
                                  <span className="block size-9 rounded-full overflow-hidden bg-muted border border-line">
                                    {c.avatarUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={c.avatarUrl} alt="" className="size-full object-cover" />
                                    ) : (
                                      <span className="flex size-full items-center justify-center font-bold text-xs text-primary">
                                        {c.displayName[0]?.toUpperCase()}
                                      </span>
                                    )}
                                  </span>
                                  <span
                                    className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full text-white ring-2 ring-[var(--bg)] shadow"
                                    style={{ background: PLATFORM_BRAND[c.platform].gradient }}
                                  >
                                    <PlatformIcon platform={c.platform} className="size-2.5" />
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-fg truncate">{c.displayName}</p>
                                  {c.username && (
                                    <p className="text-[10px] text-muted truncate">@{c.username}</p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <Link href={`/channels/${c.id}`}>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                                    Details
                                  </Button>
                                </Link>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[11px] text-red-500 hover:bg-red-500/10 hover:text-red-600"
                                  onClick={() => setRemoving(c)}
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Action Button */}
                  <div className="pt-4 border-t border-line/50 mt-4">
                    {!isConfigured && !hasConnected ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSetupGuidePlatform(p)}
                        className="w-full justify-center gap-1.5"
                      >
                        <BookOpen className="size-3.5 text-primary" />
                        Setup Guide & Instructions
                      </Button>
                    ) : p === 'whatsapp' ? (
                      <div className="flex items-center gap-2 w-full">
                        <Button
                          size="sm"
                          variant={hasConnected ? 'secondary' : 'primary'}
                          onClick={() => connect(p)}
                          className="flex-1 justify-center gap-1.5"
                        >
                          <QrCode className="size-3.5" />
                          {hasConnected ? 'Re-pair via QR' : 'Scan QR to Connect'}
                        </Button>
                        <Link href="/settings?tab=whatsapp">
                          <Button size="sm" variant="ghost" className="px-2.5 h-8" title="WhatsApp Configuration">
                            <Settings className="size-3.5 text-muted hover:text-fg" />
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant={hasConnected ? 'secondary' : 'primary'}
                        disabled={!isConfigured}
                        loading={isBusy}
                        onClick={() => connect(p)}
                        className="w-full justify-center"
                      >
                        <Plug className="size-3.5" />
                        {hasConnected
                          ? `+ Add Another ${PLATFORM_RULES[p].label}`
                          : `Connect ${PLATFORM_RULES[p].label}`}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            </StaggerItem>
          );
        })}
      </Stagger>

      <Modal open={removing !== null} onClose={() => setRemoving(null)} title="Disconnect channel?">
        <p className="text-sm text-muted">
          <b className="text-fg">{removing?.displayName}</b> will be disconnected from{' '}
          {removing ? PLATFORM_RULES[removing.platform as Platform]?.label : ''}. Scheduled posts will be canceled.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRemoving(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={disconnect} loading={busyDisconnect}>
            Disconnect
          </Button>
        </div>
      </Modal>

      {setupGuidePlatform && (
        <NetworkSetupModal
          platform={setupGuidePlatform}
          isConfigured={configured.get(setupGuidePlatform) ?? false}
          onClose={() => setSetupGuidePlatform(null)}
          onConnect={connect}
          connecting={connecting === setupGuidePlatform}
        />
      )}

      <WhatsAppModal
        open={whatsappModalOpen}
        onClose={() => {
          setWhatsappModalOpen(false);
          invalidate('channels', 'whatsapp');
        }}
      />
    </div>
  );
}

function WhatsAppStatusPanel() {
  const [statusText, setStatusText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetStatus = async () => {
    if (!statusText.trim()) {
      toast.error('Please enter a status message');
      return;
    }
    setLoading(true);
    try {
      await api('/whatsapp/status/profile', {
        method: 'POST',
        json: { status: statusText.trim() },
      });
      toast.success('WhatsApp status updated! 🟢', {
        description: 'Your profile About / Bio and WhatsApp story have been updated.',
      });
      setStatusText('');
    } catch (err) {
      toast.error('Failed to set WhatsApp status', {
        description: (err as ApiError).message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-6">
        {/* Icon + description */}
        <div className="flex items-start gap-4 flex-1">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500 ring-8 ring-emerald-500/10 shrink-0">
            <MessageSquare className="size-6" />
          </div>
          <div className="space-y-1 min-w-0">
            <h3 className="text-base font-bold tracking-tight">
              Set WhatsApp Status
            </h3>
            <p className="text-xs text-muted max-w-md">
              Update your WhatsApp profile About / Bio and broadcast a WhatsApp status story using{' '}
              <code className="rounded bg-emerald-500/10 px-1 py-0.5 font-mono text-[11px] text-emerald-500">
                client.setStatus()
              </code>
              . Max ~139 characters. This will also be used when you select &ldquo;Set Status&rdquo; in the post composer.
            </p>
          </div>
        </div>

        {/* Input + button */}
        <div className="flex flex-col gap-2 sm:w-80">
          <div className="relative">
            <textarea
              value={statusText}
              onChange={(e) => setStatusText(e.target.value.slice(0, 139))}
              rows={3}
              placeholder="Hey there! Sharing my latest posts 🎉"
              className="w-full resize-none rounded-xl border border-line bg-elevated/60 px-3 py-2.5 pr-12 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60"
            />
            <span className={`absolute bottom-2.5 right-3 text-[11px] font-mono ${statusText.length > 120 ? 'text-amber-400' : 'text-muted'}`}>
              {statusText.length}/139
            </span>
          </div>
          <Button
            variant="primary"
            onClick={handleSetStatus}
            loading={loading}
            disabled={!statusText.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white w-full justify-center"
          >
            <MessageSquare className="size-4" /> Set Status Now
          </Button>
        </div>
      </div>
    </Card>
  );
}

function WhatsAppSection() {
  const { data: status, setData } = useApi<WhatsAppStatusDto>('/whatsapp/status', ['whatsapp']);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await api<WhatsAppStatusDto>('/whatsapp/connect', { method: 'POST' });
      setData(res);
      setPolling(true);
      toast.info('QR Code generated. Scan with WhatsApp on your mobile phone.');
    } catch (err) {
      toast.error('Could not initiate WhatsApp connection', {
        description: (err as ApiError).message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this WhatsApp session?')) return;
    setLoading(true);
    try {
      await api('/whatsapp/disconnect', { method: 'POST' });
      setData({ status: 'DISCONNECTED', savedInDb: true });
      invalidate('whatsapp', 'channels');
      setPolling(false);
      toast.success('WhatsApp disconnected successfully');
    } catch {
      toast.error('Could not disconnect WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!polling || status?.status === 'CONNECTED') return;

    const timer = setInterval(async () => {
      try {
        const s = await api<WhatsAppStatusDto>('/whatsapp/status');
        setData(s);
        if (s.status === 'CONNECTED') {
          setPolling(false);
          invalidate('whatsapp', 'channels');
          toast.success('WhatsApp connected and saved in database! 🎉');
        }
      } catch {
        // ignore polling errors
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [polling, status?.status, setData]);

  const isConnected = status?.status === 'CONNECTED';
  const isScanning = status?.status === 'SCAN_QR_CODE' && Boolean(status.qrCodeDataUrl);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500 ring-8 ring-emerald-500/10 shrink-0">
              <MessageSquare className="size-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight">WhatsApp Messaging</h2>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    isConnected
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : isScanning
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-card text-muted border border-line',
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      isConnected ? 'bg-emerald-400 animate-pulse' : isScanning ? 'bg-amber-400 animate-ping' : 'bg-muted',
                    )}
                  />
                  {isConnected ? 'Connected' : isScanning ? 'Awaiting Scan' : 'Disconnected'}
                </span>
              </div>
              <p className="text-xs text-muted mt-1">
                Pair WhatsApp Web to dispatch automated video and social link updates to your customers and groups.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected && (
              <Link href="/channels?platform=whatsapp">
                <Button variant="secondary" size="sm" className="gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                  <PlatformIcon platform="whatsapp" className="size-3.5" /> View in Channels
                </Button>
              </Link>
            )}
            {isConnected ? (
              <Button variant="danger" size="sm" onClick={handleDisconnect} loading={loading}>
                <Unplug className="size-4" /> Disconnect
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleConnect}
                loading={loading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <QrCode className="size-4" /> {isScanning ? 'Regenerate QR' : 'Connect WhatsApp'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Grid: Status & QR + Database Persistence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Interactive QR / Pairing */}
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <QrCode className="size-4 text-emerald-500" /> WhatsApp Web Pairing
            </h3>
            <p className="text-xs text-muted mt-1">
              Pair your phone via WhatsApp Web. Session credentials and connection attributes are persisted in the database.
            </p>
          </div>

          <div className="my-6 flex flex-col items-center justify-center min-h-[240px]">
            {isConnected ? (
              <div className="text-center space-y-3">
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500 ring-8 ring-emerald-500/10">
                  <CheckCircle2 className="size-8" />
                </div>
                <div>
                  <p className="text-base font-bold text-fg">Session Active & Ready</p>
                  <p className="text-xs text-muted">
                    {status.phone ? `+${status.phone}` : 'Paired via WhatsApp Web'}
                    {status.pushName ? ` (${status.pushName})` : ''}
                  </p>
                </div>
              </div>
            ) : isScanning ? (
              <div className="text-center space-y-3">
                <div className="inline-block p-3 rounded-2xl bg-white shadow-xl ring-4 ring-emerald-500/20">
                  <img src={status.qrCodeDataUrl!} alt="WhatsApp QR Code" className="size-48 rounded-lg" />
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-muted">
                  <RefreshCw className="size-3.5 animate-spin text-emerald-500" />
                  <span>Waiting for mobile scan...</span>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3 py-6">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-card border border-line text-muted">
                  <Phone className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-fg">No Active WhatsApp Session</p>
                  <p className="text-xs text-muted max-w-xs mx-auto mt-1">
                    Click the button below to generate a QR code and link your WhatsApp account.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConnect}
                  loading={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <QrCode className="size-4" /> Generate QR Code
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-card-strong/40 p-4 text-xs space-y-2">
            <p className="font-semibold text-fg">📱 How to link:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted">
              <li>Open WhatsApp on your mobile phone</li>
              <li>Tap <strong>Settings</strong> or <strong>Menu (⋮)</strong> &gt; <strong>Linked Devices</strong></li>
              <li>Tap <strong>Link a Device</strong> and point your camera at the QR code</li>
            </ol>
          </div>
        </Card>

        {/* Right Column: Database Stored Attributes */}
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                <Database className="size-4 text-primary" /> Stored Database Attributes
              </h3>
              <span className="text-[11px] font-mono text-muted bg-card px-2 py-0.5 rounded-full border border-line">
                table: whatsapp_sessions
              </span>
            </div>
            <p className="text-xs text-muted mt-1">
              Attributes safely isolated per tenant organization with PostgreSQL Row-Level Security.
            </p>
          </div>

          <div className="my-4 divide-y divide-line rounded-2xl border border-line bg-card/60">
            <div className="flex items-center justify-between p-3 text-xs">
              <span className="text-muted font-medium">Session Status</span>
              <span
                className={cn(
                  'font-semibold font-mono px-2 py-0.5 rounded-full text-[11px]',
                  isConnected
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : isScanning
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-card text-muted',
                )}
              >
                {status?.status ?? 'DISCONNECTED'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 text-xs">
              <span className="text-muted font-medium">Paired Phone Number</span>
              <span className="font-mono font-semibold text-fg">
                {status?.phone ? `+${status.phone}` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 text-xs">
              <span className="text-muted font-medium">Push Name / Display</span>
              <span className="font-medium text-fg">{status?.pushName ?? '—'}</span>
            </div>

            <div className="flex items-center justify-between p-3 text-xs">
              <span className="text-muted font-medium">Engine / Platform</span>
              <span className="font-mono text-fg">{status?.platform ?? 'WhatsApp Web (Chrome)'}</span>
            </div>

            <div className="flex items-center justify-between p-3 text-xs">
              <span className="text-muted font-medium">Connected At</span>
              <span className="text-muted">
                {status?.connectedAt ? new Date(status.connectedAt).toLocaleString() : 'Not connected'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 text-xs">
              <span className="text-muted font-medium">Tenant Isolation</span>
              <span className="text-emerald-400 font-mono text-[11px]">RLS Enforced (app_rls_allows)</span>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted space-y-1">
            <p className="font-semibold text-fg flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-primary" /> Automatic Fallback Support
            </p>
            <p>
              If WhatsApp Web is unlinked, customer shares generate customized{' '}
              <code className="text-primary font-mono">web.whatsapp.com/send</code> fallback links with your uploaded video URLs prefilled.
            </p>
          </div>
        </Card>
      </div>

      {/* Set Profile Status / Story Panel — only visible when connected */}
      {isConnected && <WhatsAppStatusPanel />}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('networks');
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

  useEffect(() => {
    if (params?.get('checkout') === 'success') {
      toast.success('Thanks for upgrading! 🎉', { description: 'Your new plan is active.' });
      invalidate('billing');
      setActiveTab('billing');
    }
    const tabParam = params?.get('tab') as SettingsTab | null;
    if (tabParam && SETTINGS_TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    } else if (params?.get('connect')) {
      setActiveTab('networks');
    }
  }, [params]);

  if (!user) return null;

  return (
    <div className="w-full space-y-6 pt-2">
      <FadeIn>
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2.5 text-3xl font-black tracking-tight">
            <Settings className="size-7 text-primary" /> Settings
          </h1>
          <p className="text-xs text-muted">
            Manage connected social networks, WhatsApp messaging, billing, and account preferences.
          </p>
        </div>
      </FadeIn>

      {/* Top Tab Navigation Bar */}
      <FadeIn delay={0.05}>
        <div className="no-scrollbar flex gap-2 border-b border-line pb-2 overflow-x-auto">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold transition shrink-0',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md border border-primary'
                    : 'bg-card-strong text-muted hover:bg-elevated hover:text-fg border border-line',
                )}
              >
                <Icon className="size-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </FadeIn>

      {/* Active Tab Content Section */}
      <FadeIn delay={0.1}>
        {activeTab === 'networks' && <NetworksSection />}
        {activeTab === 'whatsapp' && <WhatsAppSection />}
        {activeTab === 'ai' && <AiSettingsSection />}
        {activeTab === 'billing' && <BillingSection />}
      </FadeIn>

      {/* Brand & System Information Footer */}
      <FadeIn delay={0.15}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-line bg-card/40 px-6 py-4 text-xs text-muted backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-fg">Mehwar Flow</span>
            <span>•</span>
            <span>Enterprise Multi-Channel Suite</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Powered by</span>
            <Wordmark height={18} />
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
