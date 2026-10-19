import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../state/auth_provider.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text('More'),
        centerTitle: false,
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          // Profile mini header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                  child: Text(
                    (user?.name.isNotEmpty == true ? user!.name[0] : 'U').toUpperCase(),
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.name ?? 'User',
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        user?.email ?? '',
                        style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                      ),
                      if (user?.timezone != null) ...[
                        const SizedBox(height: 3),
                        Text(
                          user!.timezone,
                          style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          _buildSectionHeader('PUBLISH & ENGAGE'),
          _buildMenuItem(
            context,
            icon: LucideIcons.calendar,
            title: 'Content Calendar',
            subtitle: 'Visualize monthly and weekly post schedule',
            onTap: () => context.push('/calendar'),
          ),
          _buildMenuItem(
            context,
            icon: LucideIcons.users,
            title: 'Customers & Contacts',
            subtitle: 'Manage client directory and broadcast posts',
            onTap: () => context.push('/customers'),
          ),
          _buildMenuItem(
            context,
            icon: LucideIcons.bot,
            title: 'Automation & Schedulers',
            subtitle: 'Lead generation, AI runs, and cron jobs',
            onTap: () => context.push('/automation'),
          ),
          const SizedBox(height: 16),

          _buildSectionHeader('LIBRARY & CHANNELS'),
          _buildMenuItem(
            context,
            icon: LucideIcons.share2,
            title: 'Connected Channels',
            subtitle: 'Manage all 9 social platforms & WhatsApp',
            onTap: () => context.push('/channels'),
          ),
          _buildMenuItem(
            context,
            icon: LucideIcons.image,
            title: 'Media Library',
            subtitle: 'Cloud storage, uploads, and assets',
            onTap: () => context.push('/media'),
          ),
          _buildMenuItem(
            context,
            icon: LucideIcons.barChart2,
            title: 'Analytics & Reports',
            subtitle: 'Performance, engagement, and CSV exports',
            onTap: () => context.push('/analytics'),
          ),
          _buildMenuItem(
            context,
            icon: LucideIcons.bell,
            title: 'Notifications',
            subtitle: 'Channel alerts and post status logs',
            onTap: () => context.push('/notifications'),
          ),
          const SizedBox(height: 16),

          _buildSectionHeader('WORKSPACE & ACCOUNT'),
          _buildMenuItem(
            context,
            icon: LucideIcons.settings,
            title: 'Settings',
            subtitle: 'AI configuration, billing, privacy & security',
            onTap: () => context.push('/settings'),
          ),
          _buildMenuItem(
            context,
            icon: LucideIcons.logOut,
            title: 'Sign Out',
            subtitle: 'Revoke local session and return to login',
            isDestructive: true,
            onTap: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  backgroundColor: AppColors.surface,
                  title: const Text('Sign Out'),
                  content: const Text('Are you sure you want to sign out of Mehwar Flow?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('Cancel'),
                    ),
                    FilledButton(
                      style: FilledButton.styleFrom(backgroundColor: AppColors.error),
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('Sign Out'),
                    ),
                  ],
                ),
              );
              if (confirm == true && context.mounted) {
                await context.read<AuthProvider>().logout();
              }
            },
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.textMuted,
          letterSpacing: 1.1,
        ),
      ),
    );
  }

  Widget _buildMenuItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    bool isDestructive = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        child: ListTile(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          onTap: onTap,
          leading: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isDestructive ? AppColors.error.withValues(alpha: 0.12) : AppColors.surfaceLight,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              icon,
              size: 20,
              color: isDestructive ? AppColors.error : AppColors.primary,
            ),
          ),
          title: Text(
            title,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: isDestructive ? AppColors.error : AppColors.textPrimary,
            ),
          ),
          subtitle: Text(
            subtitle,
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          trailing: const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.textMuted),
        ),
      ),
    );
  }
}
