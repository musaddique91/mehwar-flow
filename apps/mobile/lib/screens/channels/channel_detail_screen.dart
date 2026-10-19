import 'package:flutter/material.dart';
import '../../models/channel_model.dart';
import '../../services/channels_service.dart';

class ChannelDetailScreen extends StatefulWidget {
  final String channelId;
  const ChannelDetailScreen({super.key, required this.channelId});

  @override
  State<ChannelDetailScreen> createState() => _ChannelDetailScreenState();
}

class _ChannelDetailScreenState extends State<ChannelDetailScreen> {
  final ChannelsService _service = ChannelsService();
  ChannelDetailDto? _detail;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  Future<void> _loadDetail() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final detail = await _service.getChannelDetail(widget.channelId);
      setState(() => _detail = detail);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _confirmDisconnect() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Disconnect Channel'),
        content: Text('Are you sure you want to disconnect "${_detail?.channel.name}"? Scheduled posts for this channel may fail.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Disconnect', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _service.removeChannel(widget.channelId);
        if (mounted) {
          Navigator.pop(context, true); // return true indicating deletion
        }
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_detail?.channel.name ?? 'Channel Details'),
        actions: [
          if (_detail != null)
            IconButton(
              icon: const Icon(Icons.delete_outline, color: Colors.red),
              onPressed: _confirmDisconnect,
            ),
        ],
      ),
      body: _loading && _detail == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _detail == null
              ? Center(child: Text('Error: $_error'))
              : _detail == null
                  ? const Center(child: Text('Channel not found.'))
                  : RefreshIndicator(
                      onRefresh: _loadDetail,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _buildHeader(_detail!.channel),
                          const SizedBox(height: 20),
                          _buildStats(_detail!),
                          const SizedBox(height: 24),
                          const Text('Recent Target Posts', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 12),
                          _buildRecentPosts(_detail!.recentPosts),
                        ],
                      ),
                    ),
    );
  }

  Widget _buildHeader(ChannelDto channel) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 30,
              backgroundImage: channel.picture != null ? NetworkImage(channel.picture!) : null,
              child: channel.picture == null ? Text(channel.name.isNotEmpty ? channel.name[0] : '?') : null,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(channel.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.blue.withAlpha(30),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          channel.platform.toUpperCase(),
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.blue),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: channel.status == 'connected' ? Colors.green : Colors.orange,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(channel.status, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStats(ChannelDetailDto detail) {
    return Row(
      children: [
        Expanded(
          child: _statCard('Total Posts', '${detail.postCount}', Icons.send),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _statCard('Followers', detail.followersCount != null ? '${detail.followersCount}' : 'N/A', Icons.people),
        ),
      ],
    );
  }

  Widget _statCard(String label, String value, IconData icon) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(icon, size: 28, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
      ),
    );
  }

  Widget _buildRecentPosts(List<dynamic> posts) {
    if (posts.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Center(child: Text('No recent posts for this channel.')),
        ),
      );
    }
    return Column(
      children: posts.map((p) {
        final content = p['post']?['content'] ?? p['content'] ?? 'No text';
        final status = p['status'] ?? 'published';
        final isSuccess = status == 'published' || status == 'success';
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            leading: Icon(
              isSuccess ? Icons.check_circle : Icons.error,
              color: isSuccess ? Colors.green : Colors.red,
            ),
            title: Text(content, maxLines: 2, overflow: TextOverflow.ellipsis),
            subtitle: Text('Status: $status'),
          ),
        );
      }).toList(),
    );
  }
}
