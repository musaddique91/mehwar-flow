class PlanLimits {
  final String label;
  final int priceUsd;
  final int channels;
  final int scheduledPosts;
  final int storageBytes;
  final int aiCreditsPerMonth;

  PlanLimits({
    required this.label,
    required this.priceUsd,
    required this.channels,
    required this.scheduledPosts,
    required this.storageBytes,
    required this.aiCreditsPerMonth,
  });

  factory PlanLimits.fromJson(Map<String, dynamic> json) => PlanLimits(
        label: json['label'] as String? ?? '',
        priceUsd: (json['priceUsd'] as num?)?.toInt() ?? 0,
        channels: (json['channels'] as num?)?.toInt() ?? 0,
        scheduledPosts: (json['scheduledPosts'] as num?)?.toInt() ?? 0,
        storageBytes: (json['storageBytes'] as num?)?.toInt() ?? 0,
        aiCreditsPerMonth: (json['aiCreditsPerMonth'] as num?)?.toInt() ?? 0,
      );

  int get maxChannels => channels;
  int get maxPostsPerMonth => scheduledPosts;
}

class BillingUsage {
  final int channels;
  final int scheduledPosts;
  final int storageBytes;
  final int aiCredits;

  BillingUsage({
    this.channels = 0,
    this.scheduledPosts = 0,
    this.storageBytes = 0,
    this.aiCredits = 0,
  });

  factory BillingUsage.fromJson(Map<String, dynamic> json) => BillingUsage(
        channels: (json['channels'] as num?)?.toInt() ?? 0,
        scheduledPosts: (json['scheduledPosts'] as num?)?.toInt() ?? 0,
        storageBytes: (json['storageBytes'] as num?)?.toInt() ?? 0,
        aiCredits: (json['aiCredits'] as num?)?.toInt() ?? 0,
      );

  int get connectedChannels => channels;
  int get postsThisMonth => scheduledPosts;
}

class BillingOverviewDto {
  final bool billingEnabled;
  final String plan;
  final String? status;
  final String? currentPeriodEnd;
  final PlanLimits limits;
  final BillingUsage usage;

  BillingOverviewDto({
    required this.billingEnabled,
    required this.plan,
    this.status,
    this.currentPeriodEnd,
    required this.limits,
    required this.usage,
  });

  factory BillingOverviewDto.fromJson(Map<String, dynamic> json) => BillingOverviewDto(
        billingEnabled: json['billingEnabled'] as bool? ?? false,
        plan: json['plan'] as String? ?? 'free',
        status: json['status'] as String?,
        currentPeriodEnd: json['currentPeriodEnd'] as String?,
        limits: PlanLimits.fromJson(json['limits'] as Map<String, dynamic>? ?? {}),
        usage: BillingUsage.fromJson(json['usage'] as Map<String, dynamic>? ?? {}),
      );
}
