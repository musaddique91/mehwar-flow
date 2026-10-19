class MediaDto {
  final String id;
  final String fileName;
  final String mimeType;
  final String kind;
  final int sizeBytes;
  final int? width;
  final int? height;
  final double? durationSec;
  final String status;
  final String? url;
  final String? thumbnailUrl;
  final String? processingError;
  final String createdAt;

  MediaDto({
    required this.id,
    required this.fileName,
    required this.mimeType,
    required this.kind,
    this.sizeBytes = 0,
    this.width,
    this.height,
    this.durationSec,
    this.status = 'READY',
    this.url,
    this.thumbnailUrl,
    this.processingError,
    this.createdAt = '',
  });

  factory MediaDto.fromJson(Map<String, dynamic> json) => MediaDto(
        id: json['id'] as String? ?? '',
        fileName: json['fileName'] as String? ?? json['filename'] as String? ?? '',
        mimeType: json['mimeType'] as String? ?? 'application/octet-stream',
        kind: (json['kind'] as String? ?? 'IMAGE').toUpperCase(),
        sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
        width: (json['width'] as num?)?.toInt(),
        height: (json['height'] as num?)?.toInt(),
        durationSec: (json['durationSec'] as num?)?.toDouble(),
        status: (json['status'] as String? ?? 'READY').toUpperCase(),
        url: json['url'] as String?,
        thumbnailUrl: json['thumbnailUrl'] as String?,
        processingError: json['processingError'] as String?,
        createdAt: json['createdAt'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'fileName': fileName,
        'mimeType': mimeType,
        'kind': kind,
        'sizeBytes': sizeBytes,
        'width': width,
        'height': height,
        'durationSec': durationSec,
        'status': status,
        'url': url,
        'thumbnailUrl': thumbnailUrl,
        'processingError': processingError,
        'createdAt': createdAt,
      };

  bool get isImage => kind.toUpperCase() == 'IMAGE' || mimeType.startsWith('image/');
  bool get isVideo => kind.toUpperCase() == 'VIDEO' || mimeType.startsWith('video/');
  bool get isReady => status == 'READY';
  bool get isProcessing => status == 'PROCESSING' || status == 'UPLOADING';
  bool get isFailed => status == 'FAILED';

  String get filename => fileName;
  String get mediaType => isVideo ? 'video' : 'image';
  String get displayUrl => url ?? thumbnailUrl ?? '';
}

typedef MediaItem = MediaDto;
