import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../models/channel_model.dart';
import '../../services/ai_service.dart';
import '../../services/channels_service.dart';
import '../../widgets/common/platform_avatar.dart';

class CommentsScreen extends StatefulWidget {
  const CommentsScreen({super.key});

  @override
  State<CommentsScreen> createState() => _CommentsScreenState();
}

class _CommentsScreenState extends State<CommentsScreen> {
  final ChannelsService _channelsService = ChannelsService();
  final AiService _aiService = AiService();

  List<CommentDto> _comments = [];
  bool _isLoading = true;
  String? _error;
  String _selectedPlatform = 'all';
  bool _isAnalyzing = false;
  Map<String, dynamic>? _analysisResult;

  final List<String> _platforms = [
    'all',
    'x',
    'youtube',
    'instagram',
    'facebook',
    'tiktok',
    'threads',
    'linkedin',
  ];

  @override
  void initState() {
    super.initState();
    _loadComments();
  }

  Future<void> _loadComments({bool refresh = false}) async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final res = await _channelsService.getAllComments(
        platform: _selectedPlatform == 'all' ? null : _selectedPlatform,
        refresh: refresh,
      );
      if (mounted) {
        setState(() {
          _comments = res.comments;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Comments Inbox'),
        centerTitle: false,
        actions: [
          IconButton(
            icon: _isAnalyzing
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(LucideIcons.sparkles, color: AppColors.primary),
            tooltip: 'AI Sentiment & Theme Analysis',
            onPressed: _isAnalyzing || _comments.isEmpty ? null : _analyzeCommentsWithAi,
          ),
          IconButton(
            icon: const Icon(LucideIcons.refreshCw, size: 20),
            onPressed: () => _loadComments(refresh: true),
          ),
        ],
      ),
      body: Column(
        children: [
          _buildPlatformFilterRow(),
          if (_analysisResult != null) _buildAnalysisSummaryCard(),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('Error: $_error', style: const TextStyle(color: AppColors.error)),
                            const SizedBox(height: 12),
                            FilledButton(onPressed: _loadComments, child: const Text('Retry')),
                          ],
                        ),
                      )
                    : _comments.isEmpty
                        ? _buildEmptyInbox()
                        : RefreshIndicator(
                            onRefresh: () => _loadComments(refresh: true),
                            child: ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: _comments.length,
                              itemBuilder: (context, i) => _buildCommentCard(_comments[i]),
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlatformFilterRow() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: _platforms.map((p) {
          final isSelected = _selectedPlatform == p;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(p.toUpperCase()),
              selected: isSelected,
              selectedColor: AppColors.primary.withValues(alpha: 0.18),
              onSelected: (val) {
                if (val) {
                  setState(() => _selectedPlatform = p);
                  _loadComments();
                }
              },
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildAnalysisSummaryCard() {
    final sentiment = _analysisResult?['sentiment'] ?? _analysisResult?['overallSentiment'] ?? 'Positive';
    final summary = _analysisResult?['summary'] ?? _analysisResult?['analysis'] ?? '';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(LucideIcons.brain, size: 16, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(
                'AI Sentiment: $sentiment',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.primary),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => setState(() => _analysisResult = null),
                child: const Icon(LucideIcons.x, size: 14, color: AppColors.textMuted),
              ),
            ],
          ),
          if (summary.toString().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              summary.toString(),
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCommentCard(CommentDto comment) {
    String timeAgo = '';
    final dt = DateTime.tryParse(comment.publishedAt);
    if (dt != null) {
      timeAgo = DateFormat('MMM d, h:mm a').format(dt.toLocal());
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: AppColors.surfaceLight,
                backgroundImage: comment.authorAvatarUrl != null ? NetworkImage(comment.authorAvatarUrl!) : null,
                child: comment.authorAvatarUrl == null
                    ? Text(
                        comment.authorName.isNotEmpty ? comment.authorName[0].toUpperCase() : '?',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      )
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      comment.authorName,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                    ),
                    if (timeAgo.isNotEmpty)
                      Text(timeAgo, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                  ],
                ),
              ),
              if (comment.platform != null) PlatformAvatar(platform: comment.platform!, size: 18),
            ],
          ),
          if (comment.videoTitle != null && comment.videoTitle!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                'On: ${comment.videoTitle}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
            ),
          ],
          const SizedBox(height: 10),
          Text(
            comment.text,
            style: const TextStyle(fontSize: 14, height: 1.3),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 8),
          Row(
            children: [
              if (comment.likeCount > 0) ...[
                Text(
                  '${comment.likeCount} likes',
                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                ),
                const SizedBox(width: 12),
              ],
              const Spacer(),
              IconButton(
                icon: const Icon(LucideIcons.heart, size: 16),
                tooltip: 'Like',
                onPressed: comment.channelId != null && comment.videoId != null
                    ? () => _likePost(comment.channelId!, comment.videoId!)
                    : null,
              ),
              IconButton(
                icon: const Icon(LucideIcons.messageCircle, size: 16),
                tooltip: 'Reply',
                onPressed: comment.channelId != null && comment.videoId != null
                    ? () => _showReplySheet(comment)
                    : null,
              ),
              IconButton(
                icon: const Icon(LucideIcons.trash2, size: 16, color: AppColors.textMuted),
                tooltip: 'Delete comment',
                onPressed: comment.channelId != null && comment.videoId != null
                    ? () => _deleteComment(comment.channelId!, comment.videoId!, comment.id)
                    : null,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _likePost(String channelId, String videoId) async {
    try {
      await _channelsService.likePost(channelId, videoId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Liked!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Like failed: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _showReplySheet(CommentDto comment) async {
    final controller = TextEditingController();
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  'Reply to ${comment.authorName}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(LucideIcons.x, size: 18),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              maxLines: 4,
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'Write your reply...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                icon: const Icon(LucideIcons.send, size: 16),
                label: const Text('Send Reply'),
                onPressed: () async {
                  final text = controller.text.trim();
                  if (text.isEmpty) return;
                  Navigator.pop(ctx);
                  try {
                    await _channelsService.replyToComment(
                      comment.channelId!,
                      comment.videoId!,
                      text: text,
                      parentId: comment.id,
                    );
                    _loadComments(refresh: true);
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Reply posted!')),
                      );
                    }
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Reply failed: $e'), backgroundColor: AppColors.error),
                      );
                    }
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _deleteComment(String channelId, String videoId, String commentId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Delete Comment'),
        content: const Text('Are you sure you want to delete this comment?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      await _channelsService.deleteComment(channelId, videoId, commentId);
      _loadComments(refresh: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Delete failed: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _analyzeCommentsWithAi() async {
    setState(() => _isAnalyzing = true);
    try {
      final sample = _comments.take(15).map((c) => {
        'id': c.id,
        'authorName': c.authorName,
        'text': c.text,
        'publishedAt': c.publishedAt,
      }).toList();

      final result = await _aiService.analyzeComments(comments: sample);
      if (mounted) {
        setState(() {
          _analysisResult = result;
          _isAnalyzing = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isAnalyzing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('AI analysis failed: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Widget _buildEmptyInbox() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          Icon(LucideIcons.messageSquare, size: 48, color: AppColors.textMuted),
          SizedBox(height: 14),
          Text('No comments found', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          SizedBox(height: 6),
          Text(
            'New responses across your active social channels will appear here.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
        ],
      ),
    );
  }
}
