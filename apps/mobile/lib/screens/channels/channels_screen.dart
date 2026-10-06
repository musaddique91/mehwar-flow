import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/platform_brand.dart';
import '../../models/channel_model.dart';
import '../../state/channels_provider.dart';
import '../../widgets/common/platform_avatar.dart';

class ChannelsScreen extends StatefulWidget {
  const ChannelsScreen({super.key});

  @override
  State<ChannelsScreen> createState() => _ChannelsScreenState();
}

class _ChannelsScreenState extends State<ChannelsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ChannelsProvider>().fetchChannels();
    });
  }

  Future<void> _connectPlatform(String platform) async {
    // Build the OAuth initiation URL from the backend
    final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
    final authUrl = '$base/channels/$platform/auth-url';

    // Fetch the actual OAuth URL from the backend
    try {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => const Center(child: CircularProgressIndicator(color: AppColors.primaryTeal)),
      );
      final client = context.read<ChannelsProvider>();
      final oauthUrl = await client.getAuthUrl(platform);
      if (mounted) Navigator.of(context).pop(); // dismiss loader

      if (oauthUrl != null) {
        final uri = Uri.parse(oauthUrl);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Connect $platform via: $authUrl')),
          );
        }
      }
    } catch (e) {
      if (mounted) Navigator.of(context, rootNavigator: true).pop();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  void _showConnectSheet() {
    final connected = context.read<ChannelsProvider>().allChannels.map((c) => c.platform).toSet();
    final available = kAllPlatforms.where((p) => !connected.contains(p)).toList();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.4,
        maxChildSize: 0.85,
        expand: false,
        builder: (ctx, scrollController) {
          return Container(
            decoration: const BoxDecoration(
              color: AppColors.cardSurface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            child: Column(
              children: [
                const SizedBox(height: 12),
                Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.softMistSurface,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 20, 24, 8),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Connect a Channel',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textHeadline,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'OAuth is handled securely via the Mehwar backend.',
                              style: TextStyle(fontSize: 13, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(LucideIcons.x, size: 20),
                        onPressed: () => Navigator.pop(ctx),
                        color: AppColors.textMuted,
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    controller: scrollController,
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    children: [
                      // Already connected (greyed)
                      if (connected.isNotEmpty) ...[
                        Padding(
                          padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
                          child: Text(
                            'CONNECTED',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textMuted.withValues(alpha: 0.6),
                              letterSpacing: 0.8,
                            ),
                          ),
                        ),
                        ...connected.map((p) => _platformTile(p, connected: true)),
                        const SizedBox(height: 16),
                      ],
                      Padding(
                        padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
                        child: Text(
                          'AVAILABLE TO CONNECT',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textMuted.withValues(alpha: 0.6),
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                      if (available.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(20),
                          child: Text(
                            'All supported platforms are already connected! 🎉',
                            style: TextStyle(fontSize: 14, color: AppColors.textMuted),
                            textAlign: TextAlign.center,
                          ),
                        )
                      else
                        ...available.map(
                          (p) => _platformTile(p, connected: false, onTap: () {
                            Navigator.pop(ctx);
                            _connectPlatform(p);
                          }),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _platformTile(String platform, {bool connected = false, VoidCallback? onTap}) {
    final brand = brandOf(platform);
    return Opacity(
      opacity: connected ? 0.5 : 1.0,
      child: InkWell(
        onTap: connected ? null : onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.inputBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.softMistSurface),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  gradient: brand.gradient,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    platformLetter(platform),
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      brand.label,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textHeadline,
                      ),
                    ),
                    Text(
                      connected ? 'Already connected' : 'Tap to connect via OAuth',
                      style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              if (connected)
                const Icon(LucideIcons.circleCheck, size: 20, color: Color(0xFF15803D))
              else
                const Icon(LucideIcons.arrowRight, size: 18, color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ChannelsProvider>();
    final channels = provider.allChannels;
    final isLoading = provider.isLoading;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.cardSurface,
        elevation: 0,
        title: const Text(
          'Connected Channels',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textHeadline),
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.refreshCw, size: 20, color: AppColors.textMuted),
            tooltip: 'Refresh',
            onPressed: () => provider.fetchChannels(),
          ),
          const SizedBox(width: 4),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primaryTeal,
        foregroundColor: Colors.white,
        icon: const Icon(LucideIcons.plus, size: 20),
        label: const Text('Connect Channel', style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: _showConnectSheet,
      ),
      body: isLoading && channels.isEmpty
          ? const Center(child: CircularProgressIndicator(color: AppColors.primaryTeal))
          : channels.isEmpty
              ? _emptyState()
              : RefreshIndicator(
                  color: AppColors.primaryTeal,
                  onRefresh: () => provider.fetchChannels(),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                    children: [
                      // Stats strip
                      _statsStrip(channels),
                      const SizedBox(height: 20),
                      // Channel cards
                      ...channels.map((ch) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _buildChannelCard(ch),
                          )),
                    ],
                  ),
                ),
    );
  }

  Widget _statsStrip(List<ChannelDto> channels) {
    final active = channels.where((c) => c.isActive).length;
    final inactive = channels.length - active;
    return Row(
      children: [
        _statPill('$active Active', const Color(0xFF15803D), const Color(0x1A16A34A)),
        if (inactive > 0) ...[
          const SizedBox(width: 8),
          _statPill('$inactive Reconnect', AppColors.warmAmber, const Color(0x1AE5A93C)),
        ],
        const Spacer(),
        Text(
          '${channels.length} total',
          style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
        ),
      ],
    );
  }

  Widget _statPill(String label, Color text, Color bg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: text)),
    );
  }

  Widget _buildChannelCard(ChannelDto channel) {
    final brand = brandOf(channel.platform);
    final isActive = channel.isActive;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AppColors.softMistSurface),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Platform avatar with gradient ring
            PlatformAvatar(
              platform: channel.platform,
              avatarUrl: channel.avatarUrl,
              size: 52,
            ),
            const SizedBox(width: 14),

            // Channel info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    channel.displayName,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textHeadline,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    channel.username != null ? '@${channel.username}' : brand.label,
                    style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),

            // Status badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: isActive
                    ? const Color(0x1A16A34A)
                    : const Color(0x1AE5A93C),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                isActive ? 'Active' : 'Reconnect',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: isActive ? const Color(0xFF15803D) : AppColors.warmAmber,
                ),
              ),
            ),
            const SizedBox(width: 4),

            // Actions menu
            PopupMenuButton<String>(
              icon: const Icon(LucideIcons.moreVertical, size: 18, color: AppColors.textMuted),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              onSelected: (val) async {
                if (val == 'reconnect') {
                  _connectPlatform(channel.platform);
                } else if (val == 'disconnect') {
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      title: const Text('Disconnect Channel'),
                      content: Text(
                        'Are you sure you want to disconnect ${channel.displayName}?\n\nScheduled posts targeting this channel will be cancelled.',
                      ),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Disconnect', style: TextStyle(color: AppColors.softRed)),
                        ),
                      ],
                    ),
                  );
                  if (ok == true && mounted) {
                    await context.read<ChannelsProvider>().deleteChannel(channel.id);
                  }
                }
              },
              itemBuilder: (_) => [
                if (!isActive)
                  const PopupMenuItem(
                    value: 'reconnect',
                    child: Row(
                      children: [
                        Icon(LucideIcons.refreshCw, size: 16, color: AppColors.primaryTeal),
                        SizedBox(width: 8),
                        Text('Reconnect'),
                      ],
                    ),
                  ),
                const PopupMenuItem(
                  value: 'disconnect',
                  child: Row(
                    children: [
                      Icon(LucideIcons.trash2, size: 16, color: AppColors.softRed),
                      SizedBox(width: 8),
                      Text('Disconnect', style: TextStyle(color: AppColors.softRed)),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Platform bubbles preview
            SizedBox(
              height: 80,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: kAllPlatforms.take(5).map((p) {
                  final brand = brandOf(p);
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: brand.gradient,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        platformLetter(p),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'No Channels Connected',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textHeadline),
            ),
            const SizedBox(height: 10),
            const Text(
              'Connect X, Instagram, Facebook, Threads, YouTube, LinkedIn and more to publish everywhere simultaneously.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: AppColors.textMuted, height: 1.5),
            ),
            const SizedBox(height: 28),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryTeal,
                foregroundColor: Colors.white,
                minimumSize: const Size(240, 52),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              icon: const Icon(LucideIcons.plus, size: 18),
              label: const Text('Connect Channel', style: TextStyle(fontWeight: FontWeight.bold)),
              onPressed: _showConnectSheet,
            ),
          ],
        ),
      ),
    );
  }
}
