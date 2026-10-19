import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../../models/billing_model.dart';
import '../../services/account_service.dart';
import '../../services/ai_service.dart';
import '../../services/billing_service.dart';
import '../../state/auth_provider.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _brandVoiceController = TextEditingController();
  final _aiApiKeyController = TextEditingController();
  final _aiModelController = TextEditingController();
  String _aiProvider = 'openai';

  final AiService _aiService = AiService();
  final BillingService _billingService = BillingService();
  final AccountService _accountService = AccountService();

  BillingOverviewDto? _billing;
  bool _updating = false;
  bool _testingAi = false;
  bool _savingAi = false;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().currentUser;
    if (user?.brandVoice != null) {
      _brandVoiceController.text = user!.brandVoice!;
    }
    _loadSettingsAndBilling();
  }

  @override
  void dispose() {
    _brandVoiceController.dispose();
    _aiApiKeyController.dispose();
    _aiModelController.dispose();
    super.dispose();
  }

  Future<void> _loadSettingsAndBilling() async {
    try {
      final aiSettings = await _aiService.getSettings();
      if (mounted) {
        setState(() {
          _aiProvider = aiSettings['provider'] ?? 'openai';
          _aiModelController.text = aiSettings['model'] ?? '';
        });
      }
    } catch (_) {}

    try {
      final billing = await _billingService.getOverview();
      if (mounted) {
        setState(() => _billing = billing);
      }
    } catch (_) {}
  }

  Future<void> _saveBrandVoice() async {
    setState(() => _updating = true);
    final success = await context.read<AuthProvider>().updateProfile({
      'brandVoice': _brandVoiceController.text.trim(),
    });
    setState(() => _updating = false);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(success ? 'Brand voice updated' : 'Update failed'),
          backgroundColor: success ? AppColors.successGreen : AppColors.softRed,
        ),
      );
    }
  }

  Future<void> _testAiConnection() async {
    setState(() => _testingAi = true);
    try {
      final res = await _aiService.testConnection(
        provider: _aiProvider,
        apiKey: _aiApiKeyController.text.trim().isEmpty ? null : _aiApiKeyController.text.trim(),
        model: _aiModelController.text.trim().isEmpty ? null : _aiModelController.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('AI Test: ${res['message'] ?? 'Connection successful!'}'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('AI Test failed: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      setState(() => _testingAi = false);
    }
  }

  Future<void> _saveAiSettings() async {
    setState(() => _savingAi = true);
    try {
      await _aiService.updateSettings(
        provider: _aiProvider,
        apiKey: _aiApiKeyController.text.trim().isEmpty ? null : _aiApiKeyController.text.trim(),
        model: _aiModelController.text.trim().isEmpty ? null : _aiModelController.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('AI settings saved successfully!'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save AI settings: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      setState(() => _savingAi = false);
    }
  }

  Future<void> _openBillingPortal() async {
    try {
      final url = await _billingService.createPortalSession();
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Portal error: $e')));
    }
  }

  Future<void> _openCheckout(String plan) async {
    try {
      final url = await _billingService.createCheckoutSession(plan);
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Checkout error: $e')));
    }
  }

  Future<void> _exportData() async {
    setState(() => _exporting = true);
    try {
      final filePath = await _accountService.exportData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Workspace exported to $filePath'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Export error: $e')));
    } finally {
      setState(() => _exporting = false);
    }
  }

  Future<void> _deleteAccount() async {
    final pwdCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Account Permanently', style: TextStyle(color: Colors.red)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'This action cannot be undone. All your posts, connected channels, and customer records will be permanently removed.',
            ),
            const SizedBox(height: 16),
            TextField(
              controller: pwdCtrl,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Enter password to confirm',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete Everything'),
          ),
        ],
      ),
    );

    if (confirmed == true && pwdCtrl.text.isNotEmpty) {
      try {
        await _accountService.deleteAccount(password: pwdCtrl.text);
        if (mounted) {
          context.read<AuthProvider>().logout();
        }
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
      }
    }
  }

  Future<void> _openChangePasswordDialog() async {
    final currentCtrl = TextEditingController();
    final newCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Change Password'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: currentCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Current Password', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: newCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'New Password', border: OutlineInputBorder()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (currentCtrl.text.isEmpty || newCtrl.text.isEmpty) return;
              Navigator.pop(ctx);
              final ok = await context.read<AuthProvider>().changePassword(
                currentPassword: currentCtrl.text,
                newPassword: newCtrl.text,
              );
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(ok ? 'Password updated successfully!' : 'Failed to update password'),
                    backgroundColor: ok ? Colors.green : Colors.red,
                  ),
                );
              }
            },
            child: const Text('Update'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final user = authProvider.currentUser;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: const Text('Settings & Workspace'),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          // User Card
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: AppColors.softMistSurface),
            ),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.primaryTeal.withValues(alpha: 0.12),
                    child: Text(
                      user?.name.isNotEmpty == true ? user!.name.substring(0, 1).toUpperCase() : 'U',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primaryTeal,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              user?.name ?? 'User',
                              style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textHeadline,
                              ),
                            ),
                            if (user?.xPremium == true) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.primaryTeal,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Text(
                                  'PREMIUM',
                                  style: TextStyle(
                                    fontSize: 9,
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(
                          user?.email ?? '',
                          style: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'Timezone: ${user?.timezone ?? "UTC"}',
                          style: const TextStyle(fontSize: 12, color: AppColors.coolSlate),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Change password row
          OutlinedButton.icon(
            icon: const Icon(LucideIcons.key, size: 16),
            label: const Text('Change Password'),
            onPressed: _openChangePasswordDialog,
          ),
          const SizedBox(height: 18),

          // Billing Card
          _buildBillingCard(),
          const SizedBox(height: 18),

          // AI Provider & Settings Card
          _buildAiCard(),
          const SizedBox(height: 18),

          // Brand Voice Setting
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: AppColors.softMistSurface),
            ),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(LucideIcons.sparkles, size: 18, color: AppColors.primaryTeal),
                      SizedBox(width: 8),
                      Text(
                        'Brand Voice Guidelines',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textHeadline),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Define the personality, tone, or style your AI writing assistant follows when drafting captions.',
                    style: TextStyle(fontSize: 13, color: AppColors.textMuted, height: 1.4),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _brandVoiceController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      hintText: 'e.g., Punchy, confident, data-driven, friendly SaaS founder tone with concise bullet points...',
                    ),
                  ),
                  const SizedBox(height: 14),
                  Align(
                    alignment: Alignment.centerRight,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(140, 44),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: _updating ? null : _saveBrandVoice,
                      child: _updating
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Text('Save Voice'),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),

          // Workspace Data Export & Danger Zone
          _buildDangerZone(),
          const SizedBox(height: 18),

          // Backend Infrastructure Card
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: AppColors.softMistSurface),
            ),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'INFRASTRUCTURE & ENVIRONMENT',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textMuted,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 14),
                  _buildInfoRow('API Gateway', AppConfig.apiBaseUrl),
                  _buildInfoRow('Stack', 'NestJS 11 • Postgres 16 • Redis 7'),
                  _buildInfoRow('Object Storage', 'MinIO S3 Buckets'),
                  _buildInfoRow('Background Worker', 'BullMQ Publisher Queue'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Logout Button
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.softRed.withValues(alpha: 0.1),
              foregroundColor: AppColors.softRed,
              side: const BorderSide(color: AppColors.softRed, width: 1.2),
            ),
            icon: const Icon(LucideIcons.logOut, size: 18),
            label: const Text('Sign Out of Mehwar Flow'),
            onPressed: () async {
              final auth = context.read<AuthProvider>();
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Sign Out'),
                  content: const Text('Are you sure you want to sign out?'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('Sign Out', style: TextStyle(color: AppColors.softRed)),
                    ),
                  ],
                ),
              );
              if (confirmed == true) {
                await auth.logout();
              }
            },
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildBillingCard() {
    final b = _billing;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AppColors.softMistSurface),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(LucideIcons.creditCard, size: 18, color: AppColors.primaryTeal),
                    SizedBox(width: 8),
                    Text('Subscription & Plan', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.primaryTeal.withAlpha(30),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    (b?.plan ?? 'Free').toUpperCase(),
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primaryTeal),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (b != null) ...[
              _buildUsageMeter('Monthly Posts', b.usage.postsThisMonth, b.limits.maxPostsPerMonth),
              _buildUsageMeter('Connected Channels', b.usage.connectedChannels, b.limits.maxChannels),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _openBillingPortal,
                      child: const Text('Stripe Portal'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (b.plan.toLowerCase() == 'free')
                    Expanded(
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primaryTeal, foregroundColor: Colors.white),
                        onPressed: () => _openCheckout('pro'),
                        child: const Text('Upgrade Pro'),
                      ),
                    ),
                ],
              ),
            ] else
              const Center(child: CircularProgressIndicator()),
          ],
        ),
      ),
    );
  }

  Widget _buildUsageMeter(String label, int used, int max) {
    final pct = max > 0 ? (used / max).clamp(0.0, 1.0) : 0.0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
              Text('$used / $max', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 4),
          LinearProgressIndicator(value: pct, backgroundColor: Colors.grey.shade200, color: pct > 0.9 ? Colors.red : AppColors.primaryTeal),
        ],
      ),
    );
  }

  Widget _buildAiCard() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AppColors.softMistSurface),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(LucideIcons.bot, size: 18, color: AppColors.primaryTeal),
                SizedBox(width: 8),
                Text('AI Assistant Provider', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue: _aiProvider,
              decoration: const InputDecoration(labelText: 'Provider', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'openai', child: Text('OpenAI (GPT-4o)')),
                DropdownMenuItem(value: 'anthropic', child: Text('Anthropic (Claude 3.5)')),
                DropdownMenuItem(value: 'gemini', child: Text('Google Gemini (Flash/Pro)')),
              ],
              onChanged: (val) {
                if (val != null) setState(() => _aiProvider = val);
              },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _aiModelController,
              decoration: const InputDecoration(
                labelText: 'Model Override (Optional)',
                hintText: 'e.g. gpt-4o, claude-3-5-sonnet, gemini-1.5-pro',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _aiApiKeyController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Custom API Key (Optional BYOK)',
                hintText: 'sk-...',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _testingAi ? null : _testAiConnection,
                    child: _testingAi ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Test Connection'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _savingAi ? null : _saveAiSettings,
                    child: _savingAi ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Save Settings'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDangerZone() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: Colors.red.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(LucideIcons.shieldAlert, size: 18, color: Colors.red),
                SizedBox(width: 8),
                Text('Data & Account Privacy', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.red)),
              ],
            ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Export Workspace Data'),
              subtitle: const Text('Download all posts, analytics, media references, and customer contacts as JSON.'),
              trailing: IconButton(
                icon: _exporting ? const CircularProgressIndicator() : const Icon(LucideIcons.download),
                onPressed: _exporting ? null : _exportData,
              ),
            ),
            const Divider(),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Delete Account', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
              subtitle: const Text('Permanently erase your workspace, posts, and credentials.'),
              trailing: IconButton(
                icon: const Icon(LucideIcons.trash2, color: Colors.red),
                onPressed: _deleteAccount,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String title, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textHeadline)),
        ],
      ),
    );
  }
}
