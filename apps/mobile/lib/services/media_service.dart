import 'dart:io';
import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/network/api_exceptions.dart';
import '../models/media_model.dart';

class MediaService {
  final ApiClient _client = ApiClient();

  Future<List<MediaDto>> getMediaList() async {
    try {
      final res = await _client.dio.get('/media');
      return (res.data as List? ?? [])
          .map((e) => MediaDto.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load media');
    }
  }

  Future<List<MediaItem>> listMedia({String? type}) async {
    final list = await getMediaList();
    if (type != null && type.isNotEmpty && type.toLowerCase() != 'all') {
      return list.where((m) => m.mediaType.toLowerCase() == type.toLowerCase()).toList();
    }
    return list;
  }

  Future<MediaDto> getMedia(String id) async {
    try {
      final res = await _client.dio.get('/media/$id');
      return MediaDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to fetch media details');
    }
  }

  Future<MediaDto> uploadFile({
    required File file,
    required String fileName,
    required String mimeType,
    void Function(int sent, int total)? onProgress,
  }) async {
    try {
      final sizeBytes = await file.length();
      // Step 1: Request presigned upload URL
      final step1 = await _client.dio.post(
        '/media/uploads',
        data: {
          'fileName': fileName,
          'mimeType': mimeType,
          'sizeBytes': sizeBytes,
        },
      );
      final mediaData = step1.data['media'] as Map<String, dynamic>;
      final mediaId = mediaData['id'] as String;
      final uploadUrl = step1.data['uploadUrl'] as String;

      // Step 2: Stream file directly from disk without buffering all bytes in memory
      final fileStream = file.openRead();
      await Dio().put(
        uploadUrl,
        data: fileStream,
        options: Options(
          headers: {
            'Content-Type': mimeType,
            'Content-Length': sizeBytes,
          },
        ),
        onSendProgress: onProgress,
      );

      // Step 3: Complete upload
      final step3 = await _client.dio.post('/media/$mediaId/complete');
      return MediaDto.fromJson(step3.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Media upload failed');
    }
  }

  Future<MediaItem> uploadMedia(File file, {void Function(int sent, int total)? onProgress}) async {
    final name = file.path.split('/').last;
    final isVid = name.toLowerCase().endsWith('.mp4') ||
        name.toLowerCase().endsWith('.mov') ||
        name.toLowerCase().endsWith('.mkv') ||
        name.toLowerCase().endsWith('.webm');
    final mime = isVid ? 'video/mp4' : 'image/jpeg';
    return uploadFile(file: file, fileName: name, mimeType: mime, onProgress: onProgress);
  }

  /// Polls media until status is READY or FAILED (max 30 seconds)
  Future<MediaDto> pollUntilReady(String id, {Duration timeout = const Duration(seconds: 30)}) async {
    final deadline = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(deadline)) {
      final media = await getMedia(id);
      if (media.isReady || media.isFailed) {
        return media;
      }
      await Future.delayed(const Duration(milliseconds: 1500));
    }
    return getMedia(id);
  }

  Future<void> deleteMedia(String id) async {
    try {
      await _client.dio.delete('/media/$id');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to delete media');
    }
  }
}
