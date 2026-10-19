import 'media_model.dart';

class PostDto {
  final String id;
  final String text;
  final String? firstComment;
  final String status;
  final String? scheduledAt;
  final String timezone;
  final List<MediaDto> media;
  final List<PostTargetDto> targets;
  final DateTime createdAt;

  PostDto({
    required this.id,
    required this.text,
    this.firstComment,
    required this.status,
    this.scheduledAt,
    required this.timezone,
    required this.media,
    required this.targets,
    required this.createdAt,
  });

  factory PostDto.fromJson(Map<String, dynamic> json) => PostDto(
        id: json['id'] as String,
        text: json['text'] as String? ?? '',
        firstComment: json['firstComment'] as String?,
        status: json['status'] as String? ?? 'DRAFT',
        scheduledAt: json['scheduledAt'] as String?,
        timezone: json['timezone'] as String? ?? 'UTC',
        media: (json['media'] as List? ?? [])
            .map((e) => MediaDto.fromJson(e as Map<String, dynamic>))
            .toList(),
        targets: (json['targets'] as List? ?? [])
            .map((e) => PostTargetDto.fromJson(e as Map<String, dynamic>))
            .toList(),
        createdAt: json['createdAt'] != null
            ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
            : DateTime.now(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'text': text,
        'firstComment': firstComment,
        'status': status,
        'scheduledAt': scheduledAt,
        'timezone': timezone,
        'media': media.map((e) => e.toJson()).toList(),
        'targets': targets.map((e) => e.toJson()).toList(),
        'createdAt': createdAt.toIso8601String(),
      };
}

class PostTargetDto {
  final String id;
  final String channelId;
  final String platform;
  final String channelName;
  final String? textOverride;
  final String status;
  final String? externalUrl;
  final String? lastError;
  final TargetOptions? options;

  PostTargetDto({
    required this.id,
    required this.channelId,
    required this.platform,
    required this.channelName,
    this.textOverride,
    required this.status,
    this.externalUrl,
    this.lastError,
    this.options,
  });

  factory PostTargetDto.fromJson(Map<String, dynamic> json) => PostTargetDto(
        id: json['id'] as String? ?? '',
        channelId: json['channelId'] as String? ?? '',
        platform: json['platform'] as String? ?? '',
        channelName: json['channelName'] as String? ?? (json['channel'] != null ? json['channel']['displayName'] as String? ?? '' : ''),
        textOverride: json['textOverride'] as String?,
        status: json['status'] as String? ?? 'PENDING',
        externalUrl: json['externalUrl'] as String?,
        lastError: json['lastError'] as String?,
        options: json['options'] is Map<String, dynamic> ? TargetOptions.fromJson(json['options'] as Map<String, dynamic>) : null,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'channelId': channelId,
        'platform': platform,
        'channelName': channelName,
        'textOverride': textOverride,
        'status': status,
        'externalUrl': externalUrl,
        'lastError': lastError,
        if (options != null) 'options': options!.toJson(),
      };
}

class TargetOptions {
  final String? title;
  final String? description;
  final String? privacy;
  final bool? madeForKids;
  final List<String>? tags;
  final String? thumbnailMediaId;
  final bool? disableComment;
  final bool? disableDuet;
  final bool? disableStitch;
  final bool? brandContent;
  final bool? brandOrganic;
  final List<String>? threadBlocks;
  final String? igMediaType;
  final String? whatsappPostType;
  final String? whatsappRecipient;

  TargetOptions({
    this.title,
    this.description,
    this.privacy,
    this.madeForKids,
    this.tags,
    this.thumbnailMediaId,
    this.disableComment,
    this.disableDuet,
    this.disableStitch,
    this.brandContent,
    this.brandOrganic,
    this.threadBlocks,
    this.igMediaType,
    this.whatsappPostType,
    this.whatsappRecipient,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (title != null && title!.isNotEmpty) map['title'] = title;
    if (description != null && description!.isNotEmpty) map['description'] = description;
    if (privacy != null && privacy!.isNotEmpty) map['privacy'] = privacy;
    if (madeForKids != null) map['madeForKids'] = madeForKids;
    if (tags != null && tags!.isNotEmpty) map['tags'] = tags;
    if (thumbnailMediaId != null) map['thumbnailMediaId'] = thumbnailMediaId;
    if (disableComment != null) map['disableComment'] = disableComment;
    if (disableDuet != null) map['disableDuet'] = disableDuet;
    if (disableStitch != null) map['disableStitch'] = disableStitch;
    if (brandContent != null) map['brandContent'] = brandContent;
    if (brandOrganic != null) map['brandOrganic'] = brandOrganic;
    if (threadBlocks != null && threadBlocks!.isNotEmpty) map['threadBlocks'] = threadBlocks;
    if (igMediaType != null && igMediaType!.isNotEmpty) map['igMediaType'] = igMediaType;
    if (whatsappPostType != null && whatsappPostType!.isNotEmpty) map['whatsappPostType'] = whatsappPostType;
    if (whatsappRecipient != null && whatsappRecipient!.isNotEmpty) map['whatsappRecipient'] = whatsappRecipient;
    return map;
  }

  factory TargetOptions.fromJson(Map<String, dynamic> json) => TargetOptions(
        title: json['title'] as String?,
        description: json['description'] as String?,
        privacy: json['privacy'] as String?,
        madeForKids: json['madeForKids'] as bool?,
        tags: (json['tags'] as List?)?.map((e) => e.toString()).toList(),
        thumbnailMediaId: json['thumbnailMediaId'] as String?,
        disableComment: json['disableComment'] as bool?,
        disableDuet: json['disableDuet'] as bool?,
        disableStitch: json['disableStitch'] as bool?,
        brandContent: json['brandContent'] as bool?,
        brandOrganic: json['brandOrganic'] as bool?,
        threadBlocks: (json['threadBlocks'] as List?)?.map((e) => e.toString()).toList(),
        igMediaType: json['igMediaType'] as String?,
        whatsappPostType: json['whatsappPostType'] as String?,
        whatsappRecipient: json['whatsappRecipient'] as String?,
      );
}

class TargetInput {
  final String channelId;
  final String? textOverride;
  final TargetOptions options;

  TargetInput({
    required this.channelId,
    this.textOverride,
    TargetOptions? options,
  }) : options = options ?? TargetOptions();

  Map<String, dynamic> toJson() => {
        'channelId': channelId,
        if (textOverride != null && textOverride!.isNotEmpty) 'textOverride': textOverride,
        'options': options.toJson(),
      };
}
