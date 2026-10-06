import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/network/api_exceptions.dart';
import '../models/post_model.dart';

class PostsService {
  final ApiClient _client = ApiClient();

  Future<List<PostDto>> getPosts({
    String? status,
    String? from,
    String? to,
    int? limit,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (status != null && status.isNotEmpty) query['status'] = status;
      if (from != null) query['from'] = from;
      if (to != null) query['to'] = to;
      if (limit != null) query['limit'] = limit;

      final res = await _client.dio.get('/posts', queryParameters: query);
      return (res.data as List? ?? [])
          .map((e) => PostDto.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException(e.message ?? 'Failed to load posts', statusCode: e.response?.statusCode);
    }
  }

  Future<PostDto> getPost(String id) async {
    try {
      final res = await _client.dio.get('/posts/$id');
      return PostDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException(e.message ?? 'Failed to load post', statusCode: e.response?.statusCode);
    }
  }

  Future<PostDto> createPost({
    required String text,
    String? firstComment,
    String? scheduledAt,
    List<String>? mediaIds,
    required List<Map<String, dynamic>> targets,
  }) async {
    try {
      final payload = <String, dynamic>{
        'text': text,
        'targets': targets,
      };
      if (firstComment != null && firstComment.isNotEmpty) {
        payload['firstComment'] = firstComment;
      }
      if (scheduledAt != null && scheduledAt.isNotEmpty) {
        payload['scheduledAt'] = scheduledAt;
      }
      if (mediaIds != null && mediaIds.isNotEmpty) {
        payload['mediaIds'] = mediaIds;
      }

      final res = await _client.dio.post('/posts', data: payload);
      return PostDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'Failed to create post';
      throw ApiException(msg is List ? msg.join(', ') : msg.toString(), statusCode: e.response?.statusCode);
    }
  }

  Future<PostDto> updatePost({
    required String id,
    required String text,
    String? firstComment,
    String? scheduledAt,
    List<String>? mediaIds,
    required List<Map<String, dynamic>> targets,
  }) async {
    try {
      final payload = <String, dynamic>{
        'text': text,
        'targets': targets,
      };
      if (firstComment != null) payload['firstComment'] = firstComment;
      if (scheduledAt != null) payload['scheduledAt'] = scheduledAt;
      if (mediaIds != null) payload['mediaIds'] = mediaIds;

      final res = await _client.dio.patch('/posts/$id', data: payload);
      return PostDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'Failed to update post';
      throw ApiException(msg is List ? msg.join(', ') : msg.toString(), statusCode: e.response?.statusCode);
    }
  }

  Future<void> deletePost(String id) async {
    try {
      await _client.dio.delete('/posts/$id');
    } on DioException catch (e) {
      throw ApiException(e.message ?? 'Failed to delete post', statusCode: e.response?.statusCode);
    }
  }

  Future<PostDto> publishNow(String id) async {
    try {
      final res = await _client.dio.post('/posts/$id/publish-now');
      return PostDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'Failed to publish post';
      throw ApiException(msg is List ? msg.join(', ') : msg.toString(), statusCode: e.response?.statusCode);
    }
  }

  Future<PostDto> schedulePost(String id, String scheduledAt) async {
    try {
      final res = await _client.dio.post('/posts/$id/schedule', data: {'scheduledAt': scheduledAt});
      return PostDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'Failed to schedule post';
      throw ApiException(msg is List ? msg.join(', ') : msg.toString(), statusCode: e.response?.statusCode);
    }
  }

  Future<PostDto> cancelPost(String id) async {
    try {
      final res = await _client.dio.post('/posts/$id/cancel');
      return PostDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException(e.message ?? 'Failed to cancel post', statusCode: e.response?.statusCode);
    }
  }

  Future<PostDto> retryPost(String id) async {
    try {
      final res = await _client.dio.post('/posts/$id/retry');
      return PostDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException(e.message ?? 'Failed to retry post', statusCode: e.response?.statusCode);
    }
  }
}
