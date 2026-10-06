import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/platform_brand.dart';
import '../../models/post_model.dart';
import '../../state/posts_provider.dart';

// ── Status styling mirrors Feed.tsx TARGET_STYLE ──────────────────────────────
class _TargetStyle {
  final String label;
  final Color bg;
  final Color text;
  final IconData icon;
  final bool spin;
  const _TargetStyle({
    required this.label,
    required this.bg,
    required this.text,
    required this.icon,
    this.spin = false,
  });
}

const Map<String, _TargetStyle> _targetStyle = {
  'PENDING': _TargetStyle(label: 'Draft', bg: Color(0x1A7E8B8C), text: AppColors.textMuted, icon: LucideIcons.filePen),
  'QUEUED': _TargetStyle(label: 'Scheduled', bg: Color(0x1A0EA5E9), text: Color(0xFF0369A1), icon: LucideIcons.clock),
  'PUBLISHING': _TargetStyle(label: 'Publishing', bg: Color(0x1AC026D3), text: Color(0xFFA21CAF), icon: LucideIcons.loader, spin: true),
  'PUBLISHED': _TargetStyle(label: 'Live', bg: Color(0x1A16A34A), text: Color(0xFF15803D), icon: LucideIcons.circleCheck),
  'FAILED': _TargetStyle(label: 'Failed', bg: Color(0x1AEF4444), text: Color(0xFFDC2626), icon: LucideIcons.circleAlert),
  'CANCELED': _TargetStyle(label: 'Canceled', bg: Color(0x1A7E8B8C), text: AppColors.textMuted, icon: LucideIcons.undo2),
};

const Map<String, String> _postStatusLabel = {
  'DRAFT': 'Draft',
  'SCHEDULED': 'Scheduled',
  'PUBLISHING': 'Publishing…',
  'PUBLISHED': 'Published',
  'PARTIALLY_FAILED': 'Partly failed',
  'FAILED': 'Failed',
};

class PostCard extends StatefulWidget {
  final PostDto post;
  final VoidCallback? onEdit;

  const PostCard({super.key, required this.post, this.onEdit});

  @override
  State<PostCard> createState() => _PostCardState();
}

class _PostCardState extends State<PostCard> {
  bool _busy = false;

  Future<void> _act(Future<void> Function() fn) async {
    setState(() => _busy = true);
    try {
      await fn();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showDeleteConfirm() {
    showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Delete post?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('This action cannot be undone.', style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
            if (widget.post.text.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.inputBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '"${widget.post.text}"',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.textMuted, fontStyle: FontStyle.italic),
                ),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _act(() => context.read<PostsProvider>().deletePost(widget.post.id));
            },
            child: const Text('Delete', style: TextStyle(color: AppColors.softRed)),
          ),
        ],
      ),
    );
  }

  void _showActionMenu() {
    final post = widget.post;
    final editable = ['DRAFT', 'SCHEDULED', 'FAILED', 'PARTIALLY_FAILED'].contains(post.status);
    final canCrossPost = ['PUBLISHED', 'PARTIALLY_FAILED', 'FAILED'].contains(post.status);

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        margin: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.cardSurface,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.softMistSurface,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            if (editable && widget.onEdit != null)
              _menuItem(
                icon: LucideIcons.pencil,
                label: 'Edit post',
                color: AppColors.textHeadline,
                onTap: () {
                  Navigator.pop(context);
                  widget.onEdit?.call();
                },
              ),
            if (post.status == 'DRAFT')
              _menuItem(
                icon: LucideIcons.send,
                label: 'Publish now',
                color: AppColors.primaryTeal,
                onTap: () {
                  Navigator.pop(context);
                  _act(() => context.read<PostsProvider>().publishNow(post.id));
                },
              ),
            if (post.status == 'SCHEDULED')
              _menuItem(
                icon: LucideIcons.undo2,
                label: 'Unschedule (move to draft)',
                color: AppColors.warmAmber,
                onTap: () {
                  Navigator.pop(context);
                  _act(() => context.read<PostsProvider>().cancelPost(post.id));
                },
              ),
            if (post.status == 'FAILED' || post.status == 'PARTIALLY_FAILED')
              _menuItem(
                icon: LucideIcons.refreshCw,
                label: 'Retry failed targets',
                color: AppColors.primaryTeal,
                onTap: () {
                  Navigator.pop(context);
                  _act(() => context.read<PostsProvider>().retryPost(post.id));
                },
              ),
            if (canCrossPost)
              _menuItem(
                icon: LucideIcons.share2,
                label: 'Publish to more platforms',
                color: const Color(0xFFD946EF),
                onTap: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Cross-posting: select channels in composer')),
                  );
                },
              ),
            const Divider(height: 1, indent: 20, endIndent: 20),
            _menuItem(
              icon: LucideIcons.trash2,
              label: 'Delete post',
              color: AppColors.softRed,
              onTap: () {
                Navigator.pop(context);
                _showDeleteConfirm();
              },
            ),
            SizedBox(height: MediaQuery.of(context).padding.bottom + 16),
          ],
        ),
      ),
    );
  }

  Widget _menuItem({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: color),
            ),
            const SizedBox(width: 14),
            Text(label, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: color == AppColors.softRed ? color : AppColors.textHeadline)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final dateFormat = DateFormat('MMM d, y • h:mm a');
    final String timeLabel = post.scheduledAt != null
        ? 'Scheduled · ${dateFormat.format(DateTime.tryParse(post.scheduledAt!)?.toLocal() ?? DateTime.now())}'
        : dateFormat.format(post.createdAt.toLocal());

    final String statusLabel = _postStatusLabel[post.status] ?? post.status;

    // Pick status color
    Color statusColor;
    switch (post.status) {
      case 'PUBLISHED':
        statusColor = const Color(0xFF15803D);
        break;
      case 'SCHEDULED':
        statusColor = const Color(0xFF0369A1);
        break;
      case 'FAILED':
      case 'PARTIALLY_FAILED':
        statusColor = AppColors.softRed;
        break;
      case 'PUBLISHING':
        statusColor = const Color(0xFFA21CAF);
        break;
      default:
        statusColor = AppColors.textMuted;
    }

    return Card(
      elevation: 0,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AppColors.softMistSurface, width: 1),
      ),
      child: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Header row ───────────────────────────────────────────
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: statusColor.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  statusLabel,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: statusColor,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            timeLabel,
                            style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                    GestureDetector(
                      onTap: _busy ? null : _showActionMenu,
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.inputBg,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: _busy
                            ? const Padding(
                                padding: EdgeInsets.all(8),
                                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryTeal),
                              )
                            : const Icon(LucideIcons.moreHorizontal, size: 18, color: AppColors.textMuted),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // ── Post text ─────────────────────────────────────────────
                if (post.text.isNotEmpty)
                  Text(
                    post.text,
                    maxLines: 4,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      color: AppColors.textHeadline,
                      height: 1.45,
                      fontWeight: FontWeight.w500,
                    ),
                  )
                else
                  const Text(
                    'No text',
                    style: TextStyle(
                      fontSize: 14,
                      fontStyle: FontStyle.italic,
                      color: AppColors.textMuted,
                    ),
                  ),

                // ── Media thumbnails ──────────────────────────────────────
                if (post.media.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: GridView.count(
                      crossAxisCount: post.media.length == 1 ? 1 : 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 3,
                      mainAxisSpacing: 3,
                      childAspectRatio: post.media.length == 1 ? 16 / 9 : 1,
                      children: post.media.take(4).map((m) {
                        final url = m.thumbnailUrl ?? m.url;
                        return url != null
                            ? Image.network(url, fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  color: AppColors.inputBg,
                                  child: const Icon(LucideIcons.image, color: AppColors.coolSlate),
                                ))
                            : Container(
                                color: AppColors.inputBg,
                                child: const Icon(LucideIcons.file, color: AppColors.coolSlate),
                              );
                      }).toList(),
                    ),
                  ),
                ],

                const SizedBox(height: 14),
                const Divider(height: 1, color: AppColors.softMistSurface),
                const SizedBox(height: 12),

                // ── Target chips ──────────────────────────────────────────
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: post.targets.map((t) {
                    final style = _targetStyle[t.status] ?? _targetStyle['PENDING']!;
                    final brand = brandOf(t.platform);
                    final chip = GestureDetector(
                      onTap: t.externalUrl != null
                          ? () => launchUrl(Uri.parse(t.externalUrl!), mode: LaunchMode.externalApplication)
                          : null,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: style.bg,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: brand.color,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              t.channelName.isNotEmpty ? t.channelName : t.platform.toUpperCase(),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: style.text,
                              ),
                              maxLines: 1,
                            ),
                            const SizedBox(width: 5),
                            Icon(style.icon, size: 11, color: style.text),
                            const SizedBox(width: 3),
                            Text(style.label, style: TextStyle(fontSize: 10, color: style.text)),
                            if (t.externalUrl != null) ...[
                              const SizedBox(width: 4),
                              Icon(LucideIcons.externalLink, size: 10, color: style.text),
                            ],
                          ],
                        ),
                      ),
                    );
                    return chip;
                  }).toList(),
                ),

                // ── Error messages ────────────────────────────────────────
                if (post.targets.any((t) => t.status == 'FAILED' && t.lastError != null)) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0x1AEF4444),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: post.targets
                          .where((t) => t.status == 'FAILED' && t.lastError != null)
                          .map((t) => Text(
                                '${t.channelName}: ${t.lastError}',
                                style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
                              ))
                          .toList(),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
