class ChannelDto {
  final String id;
  final String platform;
  final String displayName;
  final String? username;
  final String? avatarUrl;
  final String status;

  ChannelDto({
    required this.id,
    required this.platform,
    required this.displayName,
    this.username,
    this.avatarUrl,
    required this.status,
  });

  factory ChannelDto.fromJson(Map<String, dynamic> json) => ChannelDto(
        id: json['id'] as String,
        platform: json['platform'] as String? ?? 'x',
        displayName: json['displayName'] as String? ?? '',
        username: json['username'] as String?,
        avatarUrl: json['avatarUrl'] as String?,
        status: json['status'] as String? ?? 'ACTIVE',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'platform': platform,
        'displayName': displayName,
        'username': username,
        'avatarUrl': avatarUrl,
        'status': status,
      };

  bool get isActive => status == 'ACTIVE';
}
