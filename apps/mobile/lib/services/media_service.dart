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
      throw ApiException(e.message ?? 'Failed to load media', statusCode: e.response?.statusCode);
    }
  }

  Future<MediaDto> uploadFile({
    required File file,
    required String fileName,
    required String mimeType,
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

      // Step 2: Upload raw file bytes via PUT to presigned S3/MinIO URL
      final bytes = await file.readAsBytes();
      await Dio().put(
        uploadUrl,
        data: Stream.fromIterable([bytes]),
        options: Options(
          headers: {
            'Content-Type': mimeType,
            'Content-Length': sizeBytes,
          },
        ),
      );

      // Step 3: Complete upload
      final step3 = await _client.dio.post('/media/$mediaId/complete');
      return MediaDto.fromJson(step3.data as Map<String, dynamic>);
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'Media upload failed';
      throw ApiException(msg is List ? msg.join(', ') : msg.toString(), statusCode: e.response?.statusCode);
    }
  }

  Future<void> deleteMedia(String id) async {
    try {
      await _client.dio.delete('/media/$id');
    } on DioException catch (e) {
      throw ApiException(e.message ?? 'Failed to delete media', statusCode: e.response?.statusCode);
    }
  }
}
