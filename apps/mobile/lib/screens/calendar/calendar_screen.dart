import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:table_calendar/table_calendar.dart';
import '../../core/theme/app_colors.dart';
import '../../models/post_model.dart';
import '../../state/posts_provider.dart';
import '../../widgets/composer/composer_modal.dart';
import '../../widgets/feed/minimal_post_card.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  CalendarFormat _calendarFormat = CalendarFormat.month;
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;

  @override
  void initState() {
    super.initState();
    _selectedDay = _focusedDay;
  }

  List<PostDto> _getPostsForDay(DateTime day, List<PostDto> allPosts) {
    return allPosts.where((post) {
      DateTime? postDate;
      if (post.scheduledAt != null) {
        postDate = DateTime.tryParse(post.scheduledAt!);
      } else {
        postDate = post.createdAt;
      }
      if (postDate == null) return false;
      return isSameDay(postDate.toLocal(), day);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final postsProvider = context.watch<PostsProvider>();
    final allPosts = postsProvider.allPosts;
    final selectedPosts = _selectedDay != null ? _getPostsForDay(_selectedDay!, allPosts) : <PostDto>[];

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: const Text('Publishing Calendar'),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.refreshCw, size: 20),
            tooltip: 'Refresh Calendar',
            onPressed: () => postsProvider.fetchPosts(),
          ),
          IconButton(
            icon: const Icon(LucideIcons.plus, size: 22, color: AppColors.primaryTeal),
            tooltip: 'New Post',
            onPressed: () => ComposerModal.show(context),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primaryTeal,
        onRefresh: () => postsProvider.fetchPosts(),
        child: Column(
          children: [
            // Calendar widget card
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.cardSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.softMistSurface),
              ),
              child: TableCalendar<PostDto>(
                firstDay: DateTime.now().subtract(const Duration(days: 180)),
                lastDay: DateTime.now().add(const Duration(days: 365)),
                focusedDay: _focusedDay,
                calendarFormat: _calendarFormat,
                selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
                eventLoader: (day) => _getPostsForDay(day, allPosts),
                onDaySelected: (selectedDay, focusedDay) {
                  setState(() {
                    _selectedDay = selectedDay;
                    _focusedDay = focusedDay;
                  });
                },
                onFormatChanged: (format) {
                  setState(() => _calendarFormat = format);
                },
                onPageChanged: (focusedDay) {
                  _focusedDay = focusedDay;
                },
                calendarStyle: CalendarStyle(
                  outsideDaysVisible: false,
                  selectedDecoration: const BoxDecoration(
                    color: AppColors.primaryTeal,
                    shape: BoxShape.circle,
                  ),
                  todayDecoration: BoxDecoration(
                    color: AppColors.primaryTeal.withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  todayTextStyle: const TextStyle(
                    color: AppColors.primaryTeal,
                    fontWeight: FontWeight.bold,
                  ),
                  markerDecoration: const BoxDecoration(
                    color: AppColors.warmAmber,
                    shape: BoxShape.circle,
                  ),
                ),
                headerStyle: const HeaderStyle(
                  formatButtonVisible: true,
                  titleCentered: true,
                  formatButtonShowsNext: false,
                  titleTextStyle: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textHeadline,
                  ),
                ),
              ),
            ),

            // Header for selected day posts
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _selectedDay != null
                        ? DateFormat('EEEE, MMMM d').format(_selectedDay!)
                        : 'Select a Date',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textHeadline,
                    ),
                  ),
                  Text(
                    '${selectedPosts.length} post${selectedPosts.length == 1 ? '' : 's'}',
                    style: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),

            // Post list on selected day
            Expanded(
              child: selectedPosts.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              LucideIcons.calendarCheck,
                              size: 44,
                              color: AppColors.coolSlate,
                            ),
                            const SizedBox(height: 14),
                            const Text(
                              'No posts scheduled for this day',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textHeadline,
                              ),
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'Schedule your social content to keep your channels consistent.',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 13, color: AppColors.textMuted),
                            ),
                            const SizedBox(height: 18),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                minimumSize: const Size(200, 48),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                              icon: const Icon(LucideIcons.plus, size: 18),
                              label: const Text('Schedule Post'),
                              onPressed: () => ComposerModal.show(context),
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView.builder(
                      itemCount: selectedPosts.length,
                      padding: const EdgeInsets.only(bottom: 24),
                      itemBuilder: (context, idx) {
                        final post = selectedPosts[idx];
                        return PostCard(
                          post: post,
                          onEdit: () => ComposerModal.showEdit(context, post: post),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
