class NotificationDto {
  final String id;
  final String kind;
  final String title;
  final String? body;
  final String? link;
  final String? readAt;
  final String createdAt;

  NotificationDto({
    required this.id,
    required this.kind,
    required this.title,
    this.body,
    this.link,
    this.readAt,
    required this.createdAt,
  });

  factory NotificationDto.fromJson(Map<String, dynamic> json) => NotificationDto(
        id: json['id'] as String? ?? '',
        kind: json['kind'] as String? ?? json['type'] as String? ?? 'info',
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? json['message'] as String?,
        link: json['link'] as String?,
        readAt: json['readAt'] as String?,
        createdAt: json['createdAt'] as String? ?? '',
      );

  bool get isRead => readAt != null;
  String get type => kind;
  String get message => body ?? '';
  DateTime get createdDateTime => DateTime.tryParse(createdAt) ?? DateTime.now();
}
