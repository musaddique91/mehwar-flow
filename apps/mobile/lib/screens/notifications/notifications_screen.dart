import 'package:flutter/material.dart';
import '../../models/notification_model.dart';
import '../../services/notifications_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final NotificationsService _service = NotificationsService();
  List<NotificationDto> _notifications = [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await _service.listNotifications();
      setState(() => _notifications = list);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _markAllRead() async {
    try {
      await _service.markAllRead();
      setState(() {
        _notifications = _notifications.map((n) => NotificationDto(
          id: n.id,
          kind: n.kind,
          title: n.title,
          body: n.body,
          link: n.link,
          readAt: DateTime.now().toIso8601String(),
          createdAt: n.createdAt,
        )).toList();
      });
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _markRead(NotificationDto n) async {
    if (n.isRead) return;
    try {
      await _service.markRead(n.id);
      setState(() {
        final idx = _notifications.indexWhere((x) => x.id == n.id);
        if (idx != -1) {
          _notifications[idx] = NotificationDto(
            id: n.id,
            kind: n.kind,
            title: n.title,
            body: n.body,
            link: n.link,
            readAt: DateTime.now().toIso8601String(),
            createdAt: n.createdAt,
          );
        }
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _notifications.where((n) => !n.isRead).length;

    return Scaffold(
      appBar: AppBar(
        title: Text(unreadCount > 0 ? 'Notifications ($unreadCount)' : 'Notifications'),
        actions: [
          if (unreadCount > 0)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: _loading && _notifications.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _notifications.isEmpty
              ? Center(child: Text('Error: $_error'))
              : _notifications.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.notifications_none, size: 64, color: Colors.grey),
                          SizedBox(height: 12),
                          Text('No notifications yet', style: TextStyle(color: Colors.grey)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadNotifications,
                      child: ListView.separated(
                        itemCount: _notifications.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final n = _notifications[index];
                          return ListTile(
                            tileColor: n.isRead ? null : Theme.of(context).colorScheme.primary.withAlpha(20),
                            leading: CircleAvatar(
                              backgroundColor: _getIconColor(n.type).withAlpha(30),
                              child: Icon(_getIcon(n.type), color: _getIconColor(n.type), size: 20),
                            ),
                            title: Text(
                              n.title,
                              style: TextStyle(
                                fontWeight: n.isRead ? FontWeight.normal : FontWeight.bold,
                              ),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(n.message),
                                const SizedBox(height: 4),
                                Text(
                                  _formatTime(n.createdDateTime),
                                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                                ),
                              ],
                            ),
                            trailing: !n.isRead
                                ? Container(
                                    width: 8,
                                    height: 8,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: Theme.of(context).colorScheme.primary,
                                    ),
                                  )
                                : null,
                            onTap: () => _markRead(n),
                          );
                        },
                      ),
                    ),
    );
  }

  IconData _getIcon(String type) {
    switch (type.toLowerCase()) {
      case 'post_success':
        return Icons.check_circle_outline;
      case 'post_failed':
        return Icons.error_outline;
      case 'comment':
        return Icons.chat_bubble_outline;
      case 'billing':
        return Icons.credit_card;
      case 'lead':
        return Icons.people_outline;
      default:
        return Icons.notifications_none;
    }
  }

  Color _getIconColor(String type) {
    switch (type.toLowerCase()) {
      case 'post_success':
        return Colors.green;
      case 'post_failed':
        return Colors.red;
      case 'comment':
        return Colors.blue;
      case 'billing':
        return Colors.purple;
      case 'lead':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else {
      return '${diff.inDays}d ago';
    }
  }
}
