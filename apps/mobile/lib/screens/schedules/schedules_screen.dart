import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/post_model.dart';
import '../../services/posts_service.dart';
import '../../state/auth_provider.dart';
import '../../state/posts_provider.dart';
import '../../widgets/common/platform_avatar.dart';

class SchedulesScreen extends StatefulWidget {
  const SchedulesScreen({super.key});

  @override
  State<SchedulesScreen> createState() => _SchedulesScreenState();
}

class _SchedulesScreenState extends State<SchedulesScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final PostsService _postsService = PostsService();
  List<Map<String, dynamic>> _slots = [];
  bool _isLoadingSlots = false;
  String? _slotsError;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadSlots();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadSlots() async {
    setState(() {
      _isLoadingSlots = true;
      _slotsError = null;
    });
    try {
      final res = await _postsService.getSlots();
      if (mounted) {
        setState(() {
          _slots = res;
          _isLoadingSlots = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _slotsError = e.toString();
          _isLoadingSlots = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Schedules'),
        centerTitle: false,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          tabs: const [
            Tab(text: 'Queue'),
            Tab(text: 'Posting Slots'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildQueueTab(),
          _buildSlotsTab(),
        ],
      ),
    );
  }

  Widget _buildQueueTab() {
    final postsProvider = context.watch<PostsProvider>();
    final scheduledPosts = postsProvider.posts.where((p) => p.status == 'SCHEDULED').toList();

    return RefreshIndicator(
      onRefresh: () => postsProvider.fetchPosts(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildNextSlotBanner(),
          const SizedBox(height: 16),
          if (postsProvider.isLoading && scheduledPosts.isEmpty)
            const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
          else if (scheduledPosts.isEmpty)
            _buildEmptyState(
              icon: LucideIcons.calendarClock,
              title: 'No scheduled posts',
              subtitle: 'Use the composer to schedule your upcoming content.',
            )
          else
            ...scheduledPosts.map((post) => _buildPostCard(post)),
        ],
      ),
    );
  }

  Widget _buildNextSlotBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          const Icon(LucideIcons.sparkles, color: AppColors.primary, size: 20),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Automated Posting Slots',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                ),
                SizedBox(height: 2),
                Text(
                  'Mehwar automatically assigns queued posts to your best slots.',
                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            onPressed: () => _tabController.animateTo(1),
            child: const Text('Manage', style: TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }

  Widget _buildPostCard(PostDto post) {
    String scheduledText = 'Scheduled';
    if (post.scheduledAt != null) {
      final dt = DateTime.tryParse(post.scheduledAt!);
      if (dt != null) {
        scheduledText = DateFormat('EEE, MMM d • h:mm a').format(dt.toLocal());
      }
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
              const Icon(LucideIcons.clock, size: 14, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(
                scheduledText,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: AppColors.primary),
              ),
              const Spacer(),
              Row(
                children: post.targets.map((t) => Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: PlatformAvatar(platform: t.platform, size: 18),
                )).toList(),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            post.text.isNotEmpty ? post.text : '(No text preview)',
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 14),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton.icon(
                icon: const Icon(LucideIcons.calendar, size: 14),
                label: const Text('Reschedule', style: TextStyle(fontSize: 12)),
                onPressed: () => _showReschedulePicker(post),
              ),
              const SizedBox(width: 4),
              TextButton.icon(
                icon: const Icon(LucideIcons.send, size: 14),
                label: const Text('Publish Now', style: TextStyle(fontSize: 12)),
                onPressed: () => _publishNow(post.id),
              ),
              const SizedBox(width: 4),
              IconButton(
                icon: const Icon(LucideIcons.xCircle, size: 16, color: AppColors.textMuted),
                tooltip: 'Cancel post',
                onPressed: () => _cancelPost(post.id),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _showReschedulePicker(PostDto post) async {
    final now = DateTime.now();
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(hours: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (pickedDate == null || !mounted) return;

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(now.add(const Duration(hours: 1))),
    );
    if (pickedTime == null || !mounted) return;

    final combined = DateTime(
      pickedDate.year,
      pickedDate.month,
      pickedDate.day,
      pickedTime.hour,
      pickedTime.minute,
    );

    final y = combined.year.toString().padLeft(4, '0');
    final m = combined.month.toString().padLeft(2, '0');
    final d = combined.day.toString().padLeft(2, '0');
    final h = combined.hour.toString().padLeft(2, '0');
    final min = combined.minute.toString().padLeft(2, '0');
    final localDateTime = '$y-$m-${d}T$h:$min';

    final user = context.read<AuthProvider>().currentUser;
    final tz = user?.timezone ?? 'UTC';

    try {
      await _postsService.schedulePost(post.id, localDateTime: localDateTime, timezone: tz);
      if (mounted) {
        context.read<PostsProvider>().fetchPosts();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Post rescheduled successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Reschedule failed: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _publishNow(String id) async {
    try {
      await _postsService.publishNow(id);
      if (mounted) {
        context.read<PostsProvider>().fetchPosts();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Post queued for immediate publishing!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _cancelPost(String id) async {
    try {
      await _postsService.cancelPost(id);
      if (mounted) {
        context.read<PostsProvider>().fetchPosts();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Post cancelled and moved to Drafts')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Cancel failed: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  // ---------- Posting Slots Tab ----------

  Widget _buildSlotsTab() {
    if (_isLoadingSlots) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_slotsError != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Failed to load slots: $_slotsError', style: const TextStyle(color: AppColors.error)),
            const SizedBox(height: 12),
            FilledButton(onPressed: _loadSlots, child: const Text('Retry')),
          ],
        ),
      );
    }

    final weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return RefreshIndicator(
      onRefresh: _loadSlots,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Weekly Posting Slots',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
              FilledButton.icon(
                icon: const Icon(LucideIcons.plus, size: 16),
                label: const Text('Add Slot'),
                onPressed: _showAddSlotDialog,
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_slots.isEmpty)
            _buildEmptyState(
              icon: LucideIcons.clock,
              title: 'No posting slots defined',
              subtitle: 'Set up recurring weekday time slots for automatic scheduling.',
            )
          else
            ..._slots.map((slot) {
              final weekday = (slot['weekday'] as num?)?.toInt() ?? 0;
              final minuteOfDay = (slot['minuteOfDay'] as num?)?.toInt() ?? 0;
              final hour = minuteOfDay ~/ 60;
              final min = minuteOfDay % 60;
              final timeFormatted = DateFormat('h:mm a').format(DateTime(2026, 1, 1, hour, min));
              final dayName = weekdays[weekday % 7];

              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(LucideIcons.clock, size: 18, color: AppColors.primary),
                  ),
                  title: Text(dayName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                  subtitle: Text(timeFormatted, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                  trailing: IconButton(
                    icon: const Icon(LucideIcons.trash2, size: 18, color: AppColors.error),
                    onPressed: () => _deleteSlot(slot['id'] as String),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  Future<void> _showAddSlotDialog() async {
    int selectedWeekday = 1; // Monday
    TimeOfDay selectedTime = const TimeOfDay(hour: 9, minute: 0);

    final weekdays = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: AppColors.surface,
            title: const Text('Add Posting Slot'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Day of Week', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                const SizedBox(height: 6),
                DropdownButtonFormField<int>(
                  initialValue: selectedWeekday,
                  dropdownColor: AppColors.surface,
                  decoration: InputDecoration(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  items: List.generate(
                    7,
                    (i) => DropdownMenuItem(value: i, child: Text(weekdays[i])),
                  ),
                  onChanged: (val) {
                    if (val != null) setDialogState(() => selectedWeekday = val);
                  },
                ),
                const SizedBox(height: 16),
                const Text('Time of Day', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                const SizedBox(height: 6),
                OutlinedButton.icon(
                  icon: const Icon(LucideIcons.clock, size: 16),
                  label: Text(selectedTime.format(context)),
                  onPressed: () async {
                    final picked = await showTimePicker(
                      context: context,
                      initialTime: selectedTime,
                    );
                    if (picked != null) {
                      setDialogState(() => selectedTime = picked);
                    }
                  },
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  Navigator.pop(ctx);
                  final minuteOfDay = selectedTime.hour * 60 + selectedTime.minute;
                  try {
                    await _postsService.addSlot(weekday: selectedWeekday, minuteOfDay: minuteOfDay);
                    _loadSlots();
                  } catch (e) {
                    if (mounted) {
                      messenger.showSnackBar(
                        SnackBar(content: Text('Failed to add slot: $e'), backgroundColor: AppColors.error),
                      );
                    }
                  }
                },
                child: const Text('Save Slot'),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _deleteSlot(String id) async {
    try {
      await _postsService.removeSlot(id);
      _loadSlots();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to delete slot: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Widget _buildEmptyState({required IconData icon, required String title, required String subtitle}) {
    return Container(
      padding: const EdgeInsets.all(40),
      alignment: Alignment.center,
      child: Column(
        children: [
          Icon(icon, size: 48, color: AppColors.textMuted),
          const SizedBox(height: 14),
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 6),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
        ],
      ),
    );
  }
}
