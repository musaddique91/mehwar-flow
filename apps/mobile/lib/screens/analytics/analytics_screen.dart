import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/analytics_model.dart';
import '../../state/analytics_provider.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AnalyticsProvider>().fetchAnalytics();
    });
  }

  @override
  Widget build(BuildContext context) {
    final analyticsProvider = context.watch<AnalyticsProvider>();
    final summary = analyticsProvider.summary;
    final isLoading = analyticsProvider.isLoading;
    final selectedDays = analyticsProvider.selectedDays;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBg,
      appBar: AppBar(
        title: const Text('Analytics & Performance'),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.refreshCw, size: 20),
            tooltip: 'Sync Analytics',
            onPressed: () => analyticsProvider.syncAnalytics(),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primaryTeal,
        onRefresh: () => analyticsProvider.syncAnalytics(),
        child: isLoading && summary == null
            ? const Center(child: CircularProgressIndicator(color: AppColors.primaryTeal))
            : summary == null
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(LucideIcons.barChart2, size: 48, color: AppColors.coolSlate),
                        const SizedBox(height: 16),
                        const Text('No analytics data available yet', style: TextStyle(color: AppColors.textMuted)),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: () => analyticsProvider.syncAnalytics(),
                          child: const Text('Sync Now'),
                        ),
                      ],
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    children: [
                      // Range Selector Chips (7d, 14d, 30d, 90d)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [7, 14, 30, 90].map((days) {
                          final isSelected = selectedDays == days;
                          return Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: ChoiceChip(
                              label: Text('${days}D'),
                              selected: isSelected,
                              selectedColor: AppColors.primaryTeal,
                              backgroundColor: AppColors.cardSurface,
                              side: BorderSide(
                                color: isSelected ? AppColors.primaryTeal : AppColors.softMistSurface,
                              ),
                              labelStyle: TextStyle(
                                color: isSelected ? Colors.white : AppColors.textHeadline,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                              onSelected: (_) => analyticsProvider.setDays(days),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 16),

                      // Metric Cards Grid
                      Row(
                        children: [
                          Expanded(
                            child: _buildMetricCard(
                              label: 'IMPRESSIONS',
                              value: summary.totals.impressions.toString(),
                              icon: LucideIcons.eye,
                              color: AppColors.primaryTeal,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildMetricCard(
                              label: 'ENGAGEMENT',
                              value: summary.totals.totalEngagement.toString(),
                              icon: LucideIcons.heart,
                              color: AppColors.warmAmber,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: _buildMetricCard(
                              label: 'LIKES',
                              value: summary.totals.likes.toString(),
                              icon: LucideIcons.thumbsUp,
                              color: const Color(0xFF1877F2),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildMetricCard(
                              label: 'COMMENTS',
                              value: summary.totals.comments.toString(),
                              icon: LucideIcons.messageCircle,
                              color: const Color(0xFF2E7D32),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildMetricCard(
                              label: 'SHARES',
                              value: summary.totals.shares.toString(),
                              icon: LucideIcons.share2,
                              color: const Color(0xFF8E24AA),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // Chart Card
                      Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                          side: const BorderSide(color: AppColors.softMistSurface),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Engagement & Impressions Trend',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.textHeadline,
                                    ),
                                  ),
                                  Icon(LucideIcons.trendingUp, size: 18, color: AppColors.primaryTeal),
                                ],
                              ),
                              const SizedBox(height: 24),
                              SizedBox(
                                height: 180,
                                child: summary.daily.isEmpty
                                    ? const Center(child: Text('No daily trend recorded'))
                                    : LineChart(
                                        LineChartData(
                                          gridData: const FlGridData(show: false),
                                          titlesData: const FlTitlesData(
                                            topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                                            rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                                            bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                                          ),
                                          borderData: FlBorderData(show: false),
                                          lineBarsData: [
                                            LineChartBarData(
                                              spots: summary.daily.asMap().entries.map((e) {
                                                return FlSpot(e.key.toDouble(), e.value.impressions.toDouble());
                                              }).toList(),
                                              isCurved: true,
                                              color: AppColors.primaryTeal,
                                              barWidth: 3,
                                              dotData: const FlDotData(show: false),
                                              belowBarData: BarAreaData(
                                                show: true,
                                                color: AppColors.primaryTeal.withValues(alpha: 0.1),
                                              ),
                                            ),
                                            LineChartBarData(
                                              spots: summary.daily.asMap().entries.map((e) {
                                                return FlSpot(e.key.toDouble(), e.value.engagement.toDouble());
                                              }).toList(),
                                              isCurved: true,
                                              color: AppColors.warmAmber,
                                              barWidth: 2.5,
                                              dotData: const FlDotData(show: false),
                                            ),
                                          ],
                                        ),
                                      ),
                              ),
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  _buildLegend(AppColors.primaryTeal, 'Impressions'),
                                  const SizedBox(width: 20),
                                  _buildLegend(AppColors.warmAmber, 'Engagement'),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Platform Breakdown
                      if (summary.byPlatform.isNotEmpty) ...[
                        const Text(
                          'PLATFORM BREAKDOWN',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textMuted,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 10),
                        ...summary.byPlatform.map((p) => _buildPlatformCard(p)),
                        const SizedBox(height: 20),
                      ],

                      // Top Posts
                      if (summary.topPosts.isNotEmpty) ...[
                        const Text(
                          'TOP PERFORMING POSTS',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textMuted,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 10),
                        ...summary.topPosts.map((tp) => _buildTopPostCard(tp)),
                        const SizedBox(height: 24),
                      ],
                    ],
                  ),
      ),
    );
  }

  Widget _buildMetricCard({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.softMistSurface),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textMuted,
                  letterSpacing: 0.5,
                ),
              ),
              Icon(icon, size: 16, color: color),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.textHeadline,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegend(Color color, String text) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(text, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
      ],
    );
  }

  Widget _buildPlatformCard(AnalyticsPlatformBreakdown item) {
    final pColor = AppColors.platformColor(item.platform);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.softMistSurface),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(color: pColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: 10),
              Text(
                item.platform.toUpperCase(),
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textHeadline),
              ),
            ],
          ),
          Row(
            children: [
              Text(
                '${item.posts} posts',
                style: const TextStyle(fontSize: 13, color: AppColors.textMuted),
              ),
              const SizedBox(width: 16),
              Text(
                '${item.engagement} engagement',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: pColor),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTopPostCard(AnalyticsTopPost post) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.softMistSurface),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  post.text,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, color: AppColors.textHeadline, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 4),
                Text(
                  post.platform.toUpperCase(),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColors.platformColor(post.platform),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.warmAmber.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(LucideIcons.heart, size: 14, color: AppColors.warmAmber),
                const SizedBox(width: 5),
                Text(
                  post.engagement.toString(),
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFB8780E),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
