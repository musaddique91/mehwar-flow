class MediaDto {
  final String id;
  final String fileName;
  final String mimeType;
  final String kind;
  final String? url;
  final String? thumbnailUrl;

  MediaDto({
    required this.id,
    required this.fileName,
    required this.mimeType,
    required this.kind,
    this.url,
    this.thumbnailUrl,
  });

  factory MediaDto.fromJson(Map<String, dynamic> json) => MediaDto(
        id: json['id'] as String,
        fileName: json['fileName'] as String? ?? '',
        mimeType: json['mimeType'] as String? ?? 'application/octet-stream',
        kind: json['kind'] as String? ?? 'IMAGE',
        url: json['url'] as String?,
        thumbnailUrl: json['thumbnailUrl'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'fileName': fileName,
        'mimeType': mimeType,
        'kind': kind,
        'url': url,
        'thumbnailUrl': thumbnailUrl,
      };

  bool get isImage => kind.toUpperCase() == 'IMAGE' || mimeType.startsWith('image/');
  bool get isVideo => kind.toUpperCase() == 'VIDEO' || mimeType.startsWith('video/');
}
