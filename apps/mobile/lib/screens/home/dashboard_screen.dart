import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/platform_brand.dart';
import '../../models/channel_model.dart';
import '../../state/auth_provider.dart';
import '../../state/channels_provider.dart';
import '../../state/posts_provider.dart';
import '../../widgets/common/platform_avatar.dart';
import '../../widgets/composer/composer_modal.dart';
import '../../widgets/feed/minimal_post_card.dart';
import '../../widgets/shell/minimal_bottom_nav.dart';
import '../analytics/analytics_screen.dart';
import '../auth/login_screen.dart';
import '../calendar/calendar_screen.dart';
import '../channels/channels_screen.dart';
import '../settings/settings_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentTabIndex = 0;
  final TextEditingController _searchController = TextEditingController();

  // Status filters matching the web FILTERS array
  final List<Map<String, String?>> _statusFilters = [
    {'id': 'ALL', 'label': 'All', 'value': null},
    {'id': 'SCHEDULED', 'label': 'Scheduled', 'value': 'SCHEDULED'},
    {'id': 'PUBLISHED', 'label': 'Published', 'value': 'PUBLISHED'},
    {'id': 'DRAFT', 'label': 'Drafts', 'value': 'DRAFT'},
    {'id': 'FAILED', 'label': 'Needs Attention', 'value': 'FAILED'},
  ];
  String _activeFilterId = 'ALL';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _refreshData());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _refreshData() {
    if (!mounted) return;
    if (context.read<AuthProvider>().isAuthenticated) {
      context.read<PostsProvider>().fetchPosts();
      context.read<ChannelsProvider>().fetchChannels();
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();

    if (!authProvider.isInitialized) {
      return const Scaffold(
        backgroundColor: AppColors.scaffoldBg,
        body: Center(child: CircularProgressIndicator(color: AppColors.primaryTeal)),
      );
    }

    if (!authProvider.isAuthenticated) {
      return const LoginScreen();
    }

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      body: IndexedStack(
        index: _currentTabIndex,
        children: [
          _buildFeedTab(),
          const CalendarScreen(),
          const ChannelsScreen(),
          const AnalyticsScreen(),
          const SettingsScreen(),
        ],
      ),
      bottomNavigationBar: MinimalBottomNav(
        currentIndex: _currentTabIndex,
        onTap: (index) => setState(() => _currentTabIndex = index),
      ),
    );
  }

  Widget _buildFeedTab() {
    final postsProvider = context.watch<PostsProvider>();
    final channelsProvider = context.watch<ChannelsProvider>();
    final posts = postsProvider.posts;
    final isLoading = postsProvider.isLoading;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        backgroundColor: AppColors.cardSurface,
        elevation: 0,
        titleSpacing: 16,
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: AppColors.primaryTeal,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(LucideIcons.workflow, color: Colors.white, size: 18),
            ),
            const SizedBox(width: 10),
            const Text(
              'Mehwar Flow',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textHeadline,
              ),
            ),
          ],
        ),
        actions: [
          // Connected channels badge
          GestureDetector(
            onTap: () => setState(() => _currentTabIndex = 2),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
              decoration: BoxDecoration(
                color: AppColors.inputBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.softMistSurface),
              ),
              child: Row(
                children: [
                  const Icon(LucideIcons.radio, size: 13, color: AppColors.primaryTeal),
                  const SizedBox(width: 5),
                  Text(
                    '${channelsProvider.allChannels.length}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textHeadline,
                    ),
                  ),
                ],
              ),
            ),
          ),
          IconButton(
            icon: const Icon(LucideIcons.plusCircle, size: 24, color: AppColors.primaryTeal),
            tooltip: 'Create New Post',
            onPressed: () => ComposerModal.show(context),
          ),
          const SizedBox(width: 4),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primaryTeal,
        foregroundColor: Colors.white,
        elevation: 2,
        icon: const Icon(LucideIcons.penTool, size: 18),
        label: const Text('New Post', style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: () => ComposerModal.show(context),
      ),
      body: RefreshIndicator(
        color: AppColors.primaryTeal,
        onRefresh: () async => _refreshData(),
        child: CustomScrollView(
          slivers: [
            // ── Connected Channels Stories Row ────────────────────────────
            if (channelsProvider.allChannels.isNotEmpty)
              SliverToBoxAdapter(
                child: _buildChannelsStoriesRow(channelsProvider.allChannels),
              ),

            // ── Search Bar ────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.inputBg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.softMistSurface),
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (val) => postsProvider.setSearchQuery(val),
                    style: const TextStyle(fontSize: 14, color: AppColors.textHeadline),
                    decoration: InputDecoration(
                      hintText: 'Search posts…',
                      hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
                      prefixIcon: const Icon(LucideIcons.search, size: 18, color: AppColors.textMuted),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(LucideIcons.x, size: 16, color: AppColors.textMuted),
                              onPressed: () {
                                _searchController.clear();
                                postsProvider.setSearchQuery('');
                                setState(() {});
                              },
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
              ),
            ),

            // ── Status Filter Tabs ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _statusFilters.map((f) {
                      final isActive = _activeFilterId == f['id'];
                      return GestureDetector(
                        onTap: () {
                          setState(() => _activeFilterId = f['id']!);
                          postsProvider.setStatusFilter(f['value']);
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          margin: const EdgeInsets.only(right: 6),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: isActive ? AppColors.primaryTeal : AppColors.inputBg,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isActive ? AppColors.primaryTeal : AppColors.softMistSurface,
                            ),
                          ),
                          child: Text(
                            f['label']!,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: isActive ? Colors.white : AppColors.textMuted,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),
            ),

            // ── Posts List ────────────────────────────────────────────────
            if (isLoading && posts.isEmpty)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator(color: AppColors.primaryTeal)),
              )
            else if (posts.isEmpty)
              SliverFillRemaining(child: _emptyFeedState())
            else
              SliverPadding(
                padding: const EdgeInsets.only(top: 8, bottom: 96),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => PostCard(
                      post: posts[index],
                      onEdit: () => ComposerModal.showEdit(context, post: posts[index]),
                    ),
                    childCount: posts.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildChannelsStoriesRow(List<ChannelDto> channels) {
    return Container(
      color: AppColors.cardSurface,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Connected Channels',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textMuted,
                  letterSpacing: 0.4,
                ),
              ),
              GestureDetector(
                onTap: () => setState(() => _currentTabIndex = 2),
                child: const Text(
                  'Manage →',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primaryTeal),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 76,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: channels.length + 1, // +1 for "add" button
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, idx) {
                // Add button at the end
                if (idx == channels.length) {
                  return GestureDetector(
                    onTap: () => setState(() => _currentTabIndex = 2),
                    child: Column(
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            color: AppColors.inputBg,
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.softMistSurface, width: 2),
                          ),
                          child: const Icon(LucideIcons.plus, size: 20, color: AppColors.primaryTeal),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Add',
                          style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  );
                }
                final ch = channels[idx];
                final brand = brandOf(ch.platform);
                return GestureDetector(
                  onTap: () => setState(() => _currentTabIndex = 2),
                  child: Column(
                    children: [
                      PlatformAvatar(
                        platform: ch.platform,
                        avatarUrl: ch.avatarUrl,
                        size: 52,
                        showBadge: true,
                      ),
                      const SizedBox(height: 6),
                      SizedBox(
                        width: 56,
                        child: Text(
                          ch.displayName,
                          style: TextStyle(
                            fontSize: 10,
                            color: brand.color,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyFeedState() {
    return Center(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(LucideIcons.layoutList, size: 52, color: AppColors.coolSlate),
            const SizedBox(height: 20),
            const Text(
              'Your feed is waiting for its first post',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textHeadline,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            const Text(
              'Scheduled and published posts appear here with their live status on every connected network.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: AppColors.textMuted, height: 1.5),
            ),
            const SizedBox(height: 28),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryTeal,
                foregroundColor: Colors.white,
                minimumSize: const Size(200, 52),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              icon: const Icon(LucideIcons.plus, size: 18),
              label: const Text('Create Post', style: TextStyle(fontWeight: FontWeight.bold)),
              onPressed: () => ComposerModal.show(context),
            ),
          ],
        ),
      ),
    );
  }
}

// Alias for backward compat
class MinimalSearchbar extends StatelessWidget {
  final TextEditingController? controller;
  final String hintText;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onClear;

  const MinimalSearchbar({
    super.key,
    this.controller,
    this.hintText = 'Search…',
    this.onChanged,
    this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.inputBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.softMistSurface),
      ),
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        decoration: InputDecoration(
          hintText: hintText,
          hintStyle: const TextStyle(color: AppColors.textMuted),
          prefixIcon: const Icon(LucideIcons.search, size: 18, color: AppColors.textMuted),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 14),
        ),
      ),
    );
  }
}
