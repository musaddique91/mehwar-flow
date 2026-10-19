import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../models/customer_model.dart';
import '../../models/post_model.dart';
import '../../services/customers_service.dart';
import '../../services/posts_service.dart';

class PostDetailScreen extends StatefulWidget {
  final String postId;
  const PostDetailScreen({super.key, required this.postId});

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  final PostsService _postsService = PostsService();
  final CustomersService _customersService = CustomersService();

  PostDto? _post;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPost();
  }

  Future<void> _loadPost() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final post = await _postsService.getPost(widget.postId);
      setState(() => _post = post);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _retryPost() async {
    try {
      await _postsService.retryPost(widget.postId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Retrying post publishing...')),
        );
      }
      _loadPost();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Retry failed: $e')));
    }
  }

  Future<void> _cancelSchedule() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Schedule'),
        content: const Text('Are you sure you want to cancel the scheduled publication of this post?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel Schedule', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _postsService.cancelSchedule(widget.postId);
        _loadPost();
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Future<void> _deletePost() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Post'),
        content: const Text('Are you sure you want to delete this post? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _postsService.deletePost(widget.postId);
        if (mounted) Navigator.pop(context, true);
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
      }
    }
  }

  Future<void> _openShareToCustomersDialog() async {
    List<CustomerGroupDto> groups = [];
    try {
      groups = await _customersService.listGroups();
    } catch (_) {}

    final selectedGroupIds = <String>{};
    if (!mounted) return;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Share Post to Customers'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Send this post directly to WhatsApp customer groups:'),
              const SizedBox(height: 12),
              if (groups.isEmpty)
                const Text('No customer groups found. Create one in Customers first.', style: TextStyle(color: Colors.grey))
              else
                Wrap(
                  spacing: 8,
                  children: groups.map((g) {
                    final isSel = selectedGroupIds.contains(g.id);
                    return FilterChip(
                      label: Text('${g.name} (${g.customerCount})'),
                      selected: isSel,
                      onSelected: (sel) {
                        setDialogState(() {
                          if (sel) {
                            selectedGroupIds.add(g.id);
                          } else {
                            selectedGroupIds.remove(g.id);
                          }
                        });
                      },
                    );
                  }).toList(),
                ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: selectedGroupIds.isEmpty
                  ? null
                  : () async {
                      Navigator.pop(ctx);
                      try {
                        final res = await _customersService.sharePost(widget.postId, groupIds: selectedGroupIds.toList());
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Shared to ${res.sentCount} customers!')),
                          );
                        }
                      } catch (e) {
                        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Share failed: $e')));
                      }
                    },
              child: const Text('Send'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Post Details'),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_outlined),
            tooltip: 'Share to Customers',
            onPressed: _openShareToCustomersDialog,
          ),
          PopupMenuButton<String>(
            onSelected: (val) {
              if (val == 'retry') _retryPost();
              if (val == 'cancel_schedule') _cancelSchedule();
              if (val == 'delete') _deletePost();
            },
            itemBuilder: (_) => [
              if (_post?.status.toLowerCase() == 'failed')
                const PopupMenuItem(value: 'retry', child: Text('Retry Post')),
              if (_post?.status.toLowerCase() == 'scheduled')
                const PopupMenuItem(value: 'cancel_schedule', child: Text('Cancel Schedule')),
              const PopupMenuItem(value: 'delete', child: Text('Delete Post', style: TextStyle(color: Colors.red))),
            ],
          ),
        ],
      ),
      body: _loading && _post == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _post == null
              ? Center(child: Text('Error: $_error'))
              : _post == null
                  ? const Center(child: Text('Post not found'))
                  : RefreshIndicator(
                      onRefresh: _loadPost,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _buildContentCard(_post!),
                          if (_post!.media.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            _buildMediaGrid(_post!.media.map((m) => m.url ?? m.thumbnailUrl ?? '').where((u) => u.isNotEmpty).toList()),
                          ],
                          const SizedBox(height: 20),
                          _buildStatusCard(_post!),
                          const SizedBox(height: 20),
                          const Text('Target Channels', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 8),
                          _buildTargetsList(_post!.targets),
                        ],
                      ),
                    ),
    );
  }

  Widget _buildContentCard(PostDto post) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SelectableText(
              post.text,
              style: const TextStyle(fontSize: 16, height: 1.4),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.access_time, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Text(
                  'Created: ${_formatDate(post.createdAt)}',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMediaGrid(List<String> mediaUrls) {
    return SizedBox(
      height: 120,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: mediaUrls.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final url = mediaUrls[index];
          return ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(
              url,
              width: 120,
              height: 120,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 120,
                height: 120,
                color: Colors.grey.shade800,
                child: const Icon(Icons.broken_image, color: Colors.white),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildStatusCard(PostDto post) {
    final status = post.status.toLowerCase();
    final isSuccess = status == 'published' || status == 'success';
    final isFailed = status == 'failed';
    final isScheduled = status == 'scheduled';

    Color color = Colors.grey;
    IconData icon = Icons.info_outline;

    if (isSuccess) {
      color = Colors.green;
      icon = Icons.check_circle;
    } else if (isFailed) {
      color = Colors.red;
      icon = Icons.error;
    } else if (isScheduled) {
      color = Colors.orange;
      icon = Icons.schedule;
    }

    final scheduledDate = post.scheduledAt != null ? DateTime.tryParse(post.scheduledAt!) : null;

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: Icon(icon, color: color, size: 32),
        title: Text(post.status.toUpperCase(), style: TextStyle(fontWeight: FontWeight.bold, color: color)),
        subtitle: isScheduled && scheduledDate != null
            ? Text('Scheduled for: ${_formatDate(scheduledDate)}')
            : Text('Created: ${_formatDate(post.createdAt)}'),
      ),
    );
  }

  Widget _buildTargetsList(List<PostTargetDto> targets) {
    if (targets.isEmpty) {
      return const Text('No targets specified for this post.', style: TextStyle(color: Colors.grey));
    }

    return Column(
      children: targets.map((t) {
        final status = t.status.toLowerCase();
        final isPub = status == 'published' || status == 'success';
        final isFail = status == 'failed';

        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: isPub ? Colors.green.withAlpha(30) : isFail ? Colors.red.withAlpha(30) : Colors.orange.withAlpha(30),
              child: Icon(
                isPub ? Icons.check : isFail ? Icons.close : Icons.hourglass_empty,
                color: isPub ? Colors.green : isFail ? Colors.red : Colors.orange,
              ),
            ),
            title: Text(t.platform.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Status: ${t.status}'),
                if (t.lastError != null)
                  Text('Error: ${t.lastError}', style: const TextStyle(color: Colors.red, fontSize: 12)),
              ],
            ),
            trailing: t.externalUrl != null
                ? IconButton(
                    icon: const Icon(Icons.open_in_new),
                    tooltip: 'View live post',
                    onPressed: () async {
                      final uri = Uri.parse(t.externalUrl!);
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri, mode: LaunchMode.externalApplication);
                      }
                    },
                  )
                : null,
          ),
        );
      }).toList(),
    );
  }

  String _formatDate(DateTime dt) {
    return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}
