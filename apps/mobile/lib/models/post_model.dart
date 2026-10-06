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

  PostTargetDto({
    required this.id,
    required this.channelId,
    required this.platform,
    required this.channelName,
    this.textOverride,
    required this.status,
    this.externalUrl,
    this.lastError,
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
      };
}
