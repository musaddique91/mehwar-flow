class SchedulerConfigDto {
  final String id;
  final String type;
  final String name;
  final String? description;
  final bool enabled;
  final int intervalMinutes;
  final List<String> channelIds;
  final String? lastRunAt;
  final String? nextRunAt;
  final String lastStatus;
  final String? lastResultSummary;

  SchedulerConfigDto({
    required this.id,
    required this.type,
    required this.name,
    this.description,
    required this.enabled,
    required this.intervalMinutes,
    this.channelIds = const [],
    this.lastRunAt,
    this.nextRunAt,
    this.lastStatus = 'IDLE',
    this.lastResultSummary,
  });

  factory SchedulerConfigDto.fromJson(Map<String, dynamic> json) => SchedulerConfigDto(
        id: json['id'] as String? ?? '',
        type: json['type'] as String? ?? 'CUSTOM',
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
        enabled: json['enabled'] as bool? ?? false,
        intervalMinutes: (json['intervalMinutes'] as num?)?.toInt() ?? 60,
        channelIds: (json['channelIds'] as List?)?.map((e) => e.toString()).toList() ?? const [],
        lastRunAt: json['lastRunAt'] as String?,
        nextRunAt: json['nextRunAt'] as String?,
        lastStatus: json['lastStatus'] as String? ?? 'IDLE',
        lastResultSummary: json['lastResultSummary'] as String?,
      );

  String get cronExpression => intervalMinutes > 0 ? 'Every $intervalMinutes min' : 'Manual';
  String get platform => channelIds.isNotEmpty ? channelIds.first : 'ALL';
}

class SchedulerRunDto {
  final String id;
  final String type;
  final String status;
  final String startedAt;
  final String? completedAt;
  final int? durationMs;
  final int itemsProcessed;
  final String? summary;
  final String? errorMessage;

  SchedulerRunDto({
    required this.id,
    required this.type,
    required this.status,
    required this.startedAt,
    this.completedAt,
    this.durationMs,
    this.itemsProcessed = 0,
    this.summary,
    this.errorMessage,
  });

  factory SchedulerRunDto.fromJson(Map<String, dynamic> json) => SchedulerRunDto(
        id: json['id'] as String? ?? '',
        type: json['type'] as String? ?? '',
        status: json['status'] as String? ?? '',
        startedAt: json['startedAt'] as String? ?? '',
        completedAt: json['completedAt'] as String?,
        durationMs: (json['durationMs'] as num?)?.toInt(),
        itemsProcessed: (json['itemsProcessed'] as num?)?.toInt() ?? 0,
        summary: json['summary'] as String?,
        errorMessage: json['errorMessage'] as String?,
      );

  String get schedulerName => type;
  int? get durationSec => durationMs != null ? durationMs! ~/ 1000 : null;
}

class OrderInquiryDto {
  final String id;
  final String? channelName;
  final String platform;
  final String authorName;
  final String? authorAvatarUrl;
  final String commentText;
  final String? postOrVideoTitle;
  final String priority;
  final String intentCategory;
  final String status;
  final String? contactPhone;
  final String? notes;
  final String detectedAt;

  OrderInquiryDto({
    required this.id,
    this.channelName,
    required this.platform,
    required this.authorName,
    this.authorAvatarUrl,
    required this.commentText,
    this.postOrVideoTitle,
    required this.priority,
    required this.intentCategory,
    required this.status,
    this.contactPhone,
    this.notes,
    required this.detectedAt,
  });

  factory OrderInquiryDto.fromJson(Map<String, dynamic> json) => OrderInquiryDto(
        id: json['id'] as String? ?? '',
        channelName: json['channelName'] as String?,
        platform: json['platform'] as String? ?? '',
        authorName: json['authorName'] as String? ?? '',
        authorAvatarUrl: json['authorAvatarUrl'] as String?,
        commentText: json['commentText'] as String? ?? '',
        postOrVideoTitle: json['postOrVideoTitle'] as String?,
        priority: json['priority'] as String? ?? 'MEDIUM',
        intentCategory: json['intentCategory'] as String? ?? '',
        status: json['status'] as String? ?? 'NEW',
        contactPhone: json['contactPhone'] as String?,
        notes: json['notes'] as String?,
        detectedAt: json['detectedAt'] as String? ?? '',
      );

  String get customerName => authorName;
  String? get customerPhone => contactPhone;
  String? get customerEmail => null;
  String get message => commentText;
  String get createdAt => detectedAt;
}

class AutomationOverviewDto {
  final int totalSchedulers;
  final int activeSchedulers;
  final int totalRuns;
  final int totalLeads;
  final int newLeads;
  final int healthyChannels;
  final int totalChannels;

  AutomationOverviewDto({
    this.totalSchedulers = 0,
    this.activeSchedulers = 0,
    this.totalRuns = 0,
    this.totalLeads = 0,
    this.newLeads = 0,
    this.healthyChannels = 0,
    this.totalChannels = 0,
  });

  factory AutomationOverviewDto.fromJson(Map<String, dynamic> json) {
    final health = json['channelHealth'] as Map<String, dynamic>?;
    return AutomationOverviewDto(
      totalSchedulers: (json['totalSchedulers'] as num?)?.toInt() ?? 0,
      activeSchedulers: (json['activeSchedulers'] as num?)?.toInt() ?? 0,
      totalRuns: (json['totalRuns'] as num?)?.toInt() ?? 0,
      totalLeads: (json['totalLeads'] as num?)?.toInt() ?? 0,
      newLeads: (json['newLeads'] as num?)?.toInt() ?? 0,
      healthyChannels: (health?['healthy'] as num?)?.toInt() ?? 0,
      totalChannels: (health?['total'] as num?)?.toInt() ?? 0,
    );
  }

  int get runsToday => totalRuns;
  int get pendingInquiries => newLeads;
}
