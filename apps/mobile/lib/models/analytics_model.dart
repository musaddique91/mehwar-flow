class AnalyticsSummaryDto {
  final AnalyticsRange range;
  final AnalyticsTotals totals;
  final List<AnalyticsDailyPoint> daily;
  final List<AnalyticsPlatformBreakdown> byPlatform;
  final List<AnalyticsTopPost> topPosts;

  AnalyticsSummaryDto({
    required this.range,
    required this.totals,
    required this.daily,
    required this.byPlatform,
    required this.topPosts,
  });

  factory AnalyticsSummaryDto.fromJson(Map<String, dynamic> json) => AnalyticsSummaryDto(
        range: AnalyticsRange.fromJson(json['range'] as Map<String, dynamic>? ?? {}),
        totals: AnalyticsTotals.fromJson(json['totals'] as Map<String, dynamic>? ?? {}),
        daily: (json['daily'] as List? ?? [])
            .map((e) => AnalyticsDailyPoint.fromJson(e as Map<String, dynamic>))
            .toList(),
        byPlatform: (json['byPlatform'] as List? ?? [])
            .map((e) => AnalyticsPlatformBreakdown.fromJson(e as Map<String, dynamic>))
            .toList(),
        topPosts: (json['topPosts'] as List? ?? [])
            .map((e) => AnalyticsTopPost.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class AnalyticsRange {
  final String from;
  final String to;

  AnalyticsRange({required this.from, required this.to});

  factory AnalyticsRange.fromJson(Map<String, dynamic> json) => AnalyticsRange(
        from: json['from'] as String? ?? '',
        to: json['to'] as String? ?? '',
      );
}

class AnalyticsTotals {
  final int impressions;
  final int likes;
  final int comments;
  final int shares;
  final int views;

  AnalyticsTotals({
    required this.impressions,
    required this.likes,
    required this.comments,
    required this.shares,
    required this.views,
  });

  factory AnalyticsTotals.fromJson(Map<String, dynamic> json) => AnalyticsTotals(
        impressions: (json['impressions'] as num? ?? 0).toInt(),
        likes: (json['likes'] as num? ?? 0).toInt(),
        comments: (json['comments'] as num? ?? 0).toInt(),
        shares: (json['shares'] as num? ?? 0).toInt(),
        views: (json['views'] as num? ?? 0).toInt(),
      );

  int get totalEngagement => likes + comments + shares;
}

class AnalyticsDailyPoint {
  final String date;
  final int posts;
  final int impressions;
  final int engagement;

  AnalyticsDailyPoint({
    required this.date,
    required this.posts,
    required this.impressions,
    required this.engagement,
  });

  factory AnalyticsDailyPoint.fromJson(Map<String, dynamic> json) => AnalyticsDailyPoint(
        date: json['date'] as String? ?? '',
        posts: (json['posts'] as num? ?? 0).toInt(),
        impressions: (json['impressions'] as num? ?? 0).toInt(),
        engagement: (json['engagement'] as num? ?? 0).toInt(),
      );
}

class AnalyticsPlatformBreakdown {
  final String platform;
  final int posts;
  final int engagement;
  final int? followers;

  AnalyticsPlatformBreakdown({
    required this.platform,
    required this.posts,
    required this.engagement,
    this.followers,
  });

  factory AnalyticsPlatformBreakdown.fromJson(Map<String, dynamic> json) => AnalyticsPlatformBreakdown(
        platform: json['platform'] as String? ?? '',
        posts: (json['posts'] as num? ?? 0).toInt(),
        engagement: (json['engagement'] as num? ?? 0).toInt(),
        followers: (json['followers'] as num?)?.toInt(),
      );
}

class AnalyticsTopPost {
  final String postId;
  final String targetId;
  final String platform;
  final String text;
  final String? url;
  final int engagement;

  AnalyticsTopPost({
    required this.postId,
    required this.targetId,
    required this.platform,
    required this.text,
    this.url,
    required this.engagement,
  });

  factory AnalyticsTopPost.fromJson(Map<String, dynamic> json) => AnalyticsTopPost(
        postId: json['postId'] as String? ?? '',
        targetId: json['targetId'] as String? ?? '',
        platform: json['platform'] as String? ?? '',
        text: json['text'] as String? ?? '',
        url: json['url'] as String?,
        engagement: (json['engagement'] as num? ?? 0).toInt(),
      );
}
