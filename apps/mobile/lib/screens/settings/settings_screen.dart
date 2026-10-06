import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../../state/auth_provider.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _brandVoiceController = TextEditingController();
  bool _updating = false;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().currentUser;
    if (user?.brandVoice != null) {
      _brandVoiceController.text = user!.brandVoice!;
    }
  }

  @override
  void dispose() {
    _brandVoiceController.dispose();
    super.dispose();
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
