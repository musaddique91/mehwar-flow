class ChannelDto {
  final String id;
  final String platform;
  final String displayName;
  final String? username;
  final String? avatarUrl;
  final String status;
  final String? tokenExpiresAt;
  final String? createdAt;

  ChannelDto({
    required this.id,
    required this.platform,
    required this.displayName,
    this.username,
    this.avatarUrl,
    required this.status,
    this.tokenExpiresAt,
    this.createdAt,
  });

  factory ChannelDto.fromJson(Map<String, dynamic> json) => ChannelDto(
        id: json['id'] as String? ?? '',
        platform: json['platform'] as String? ?? 'x',
        displayName: json['displayName'] as String? ?? '',
        username: json['username'] as String?,
        avatarUrl: json['avatarUrl'] as String?,
        status: json['status'] as String? ?? 'ACTIVE',
        tokenExpiresAt: json['tokenExpiresAt'] as String?,
        createdAt: json['createdAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'platform': platform,
        'displayName': displayName,
        'username': username,
        'avatarUrl': avatarUrl,
        'status': status,
        'tokenExpiresAt': tokenExpiresAt,
        'createdAt': createdAt,
      };

  bool get isActive => status == 'ACTIVE';
  bool get isNeedsReconnect => status == 'NEEDS_RECONNECT';
  bool get isDisconnected => status == 'DISCONNECTED';

  String get name => displayName;
  String? get picture => avatarUrl;
}

class AvailablePlatform {
  final String platform;
  final bool configured;

  AvailablePlatform({required this.platform, required this.configured});

  factory AvailablePlatform.fromJson(Map<String, dynamic> json) => AvailablePlatform(
        platform: json['platform'] as String? ?? '',
        configured: json['configured'] as bool? ?? false,
      );
}

class PendingAccount {
  final String id;
  final String displayName;
  final String? username;
  final String? avatarUrl;
  final String? category;

  PendingAccount({
    required this.id,
    required this.displayName,
    this.username,
    this.avatarUrl,
    this.category,
  });

  factory PendingAccount.fromJson(Map<String, dynamic> json) => PendingAccount(
        id: (json['id'] ?? json['externalId'] ?? '').toString(),
        displayName: json['displayName'] as String? ?? json['name'] as String? ?? 'Account',
        username: json['username'] as String?,
        avatarUrl: json['avatarUrl'] as String? ?? json['picture'] as String?,
        category: json['category'] as String?,
      );

  String get name => displayName;
  String? get picture => avatarUrl;
}

class CommentDto {
  final String id;
  final String authorName;
  final String? authorAvatarUrl;
  final String text;
  final String publishedAt;
  final int likeCount;
  final int replyCount;
  final List<CommentDto> replies;
  final String? videoId;
  final String? videoTitle;
  final String? channelId;
  final String? platform;
  final String? channelName;

  CommentDto({
    required this.id,
    required this.authorName,
    this.authorAvatarUrl,
    required this.text,
    required this.publishedAt,
    this.likeCount = 0,
    this.replyCount = 0,
    this.replies = const [],
    this.videoId,
    this.videoTitle,
    this.channelId,
    this.platform,
    this.channelName,
  });

  factory CommentDto.fromJson(Map<String, dynamic> json) => CommentDto(
        id: json['id'] as String? ?? '',
        authorName: json['authorName'] as String? ?? 'User',
        authorAvatarUrl: json['authorAvatarUrl'] as String?,
        text: json['text'] as String? ?? '',
        publishedAt: json['publishedAt'] as String? ?? '',
        likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
        replyCount: (json['replyCount'] as num?)?.toInt() ?? 0,
        replies: (json['replies'] as List? ?? [])
            .map((e) => CommentDto.fromJson(e as Map<String, dynamic>))
            .toList(),
        videoId: json['videoId'] as String?,
        videoTitle: json['videoTitle'] as String?,
        channelId: json['channelId'] as String?,
        platform: json['platform'] as String?,
        channelName: json['channelName'] as String?,
      );
}

class ChannelDetailDto {
  final String id;
  final String platform;
  final String status;
  final String displayName;
  final String? username;
  final String channelId;
  final String title;
  final String? description;
  final String? customUrl;
  final String? avatarUrl;
  final String? bannerUrl;
  final dynamic subscriberCount;
  final dynamic viewCount;
  final int videoCount;
  final List<dynamic> videos;

  ChannelDetailDto({
    required this.id,
    required this.platform,
    required this.status,
    required this.displayName,
    this.username,
    required this.channelId,
    required this.title,
    this.description,
    this.customUrl,
    this.avatarUrl,
    this.bannerUrl,
    this.subscriberCount,
    this.viewCount,
    required this.videoCount,
    required this.videos,
  });

  factory ChannelDetailDto.fromJson(Map<String, dynamic> json) => ChannelDetailDto(
        id: json['id'] as String? ?? '',
        platform: json['platform'] as String? ?? 'x',
        status: json['status'] as String? ?? 'ACTIVE',
        displayName: json['displayName'] as String? ?? '',
        username: json['username'] as String?,
        channelId: json['channelId'] as String? ?? '',
        title: json['title'] as String? ?? '',
        description: json['description'] as String?,
        customUrl: json['customUrl'] as String?,
        avatarUrl: json['avatarUrl'] as String?,
        bannerUrl: json['bannerUrl'] as String?,
        subscriberCount: json['subscriberCount'],
        viewCount: json['viewCount'],
        videoCount: (json['videoCount'] as num?)?.toInt() ?? 0,
        videos: (json['videos'] as List? ?? []),
      );

  dynamic get followersCount => subscriberCount;
  int get postCount => videoCount;
  List<dynamic> get recentPosts => videos;
  ChannelDto get channel => ChannelDto(
        id: id,
        platform: platform,
        displayName: displayName,
        username: username,
        avatarUrl: avatarUrl,
        status: status,
      );
}

class WhatsAppStatus {
  final String status;
  final String? qrCode;
  final String? pairingCode;
  final Map<String, dynamic>? profile;

  WhatsAppStatus({
    required this.status,
    this.qrCode,
    this.pairingCode,
    this.profile,
  });

  factory WhatsAppStatus.fromJson(Map<String, dynamic> json) => WhatsAppStatus(
        status: json['status'] as String? ?? 'DISCONNECTED',
        qrCode: json['qrCode'] as String?,
        pairingCode: json['pairingCode'] as String?,
        profile: json['profile'] as Map<String, dynamic>?,
      );

  bool get isConnected => status.toUpperCase() == 'CONNECTED';
  bool get isConnecting => status.toUpperCase() == 'CONNECTING';
  String? get qr => qrCode;
}

