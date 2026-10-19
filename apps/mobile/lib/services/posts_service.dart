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
    List<String>? mediaIds,
    required List<dynamic> targets,
    String? localDateTime,
    String? timezone,
  }) async {
    try {
      final serializedTargets = targets.map((t) {
        if (t is TargetInput) return t.toJson();
        if (t is Map<String, dynamic>) return t;
        return t;
      }).toList();

      final payload = <String, dynamic>{
        'text': text,
        'targets': serializedTargets,
        'mediaIds': mediaIds ?? [],
      };
      if (firstComment != null && firstComment.isNotEmpty) {
        payload['firstComment'] = firstComment;
      }

      final res = await _client.dio.post('/posts', data: payload);
      var post = PostDto.fromJson(res.data as Map<String, dynamic>);

      // If scheduled time was provided, schedule it via the dedicated endpoint
      if (localDateTime != null && localDateTime.isNotEmpty) {
        final tz = timezone ?? 'UTC';
        post = await schedulePost(post.id, localDateTime: localDateTime, timezone: tz);
      }

      return post;
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to create post');
    }
  }

  Future<PostDto> updatePost({
    required String id,
    required String text,
    String? firstComment,
    List<String>? mediaIds,
    required List<dynamic> targets,
    String? localDateTime,
    String? timezone,
  }) async {
    try {
      final serializedTargets = targets.map((t) {
        if (t is TargetInput) return t.toJson();
        if (t is Map<String, dynamic>) return t;
        return t;
      }).toList();

      final payload = <String, dynamic>{
        'text': text,
        'targets': serializedTargets,
        if (mediaIds != null) 'mediaIds': mediaIds,
      };
      if (firstComment != null) payload['firstComment'] = firstComment;

      final res = await _client.dio.patch('/posts/$id', data: payload);
      var post = PostDto.fromJson(res.data as Map<String, dynamic>);

      if (localDateTime != null && localDateTime.isNotEmpty) {
        final tz = timezone ?? 'UTC';
        post = await schedulePost(post.id, localDateTime: localDateTime, timezone: tz);
      }

      return post;
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to update post');
    }
  }

  Future<void> deletePost(String id) async {
    try {
      await _client.dio.delete('/posts/$id');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to delete post');
    }
  }

  Future<PostDto> publishNow(String id) async {
    try {
      final res = await _client.dio.post('/posts/$id/publish-now');
      return PostDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to publish post');
    }
  }

  Future<PostDto> schedulePost(
    String id, {
    required String localDateTime,
    required String timezone,
  }) async {
    try {
      final res = await _client.dio.post(
        '/posts/$id/schedule',
        data: {
          'localDateTime': localDateTime,
          'timezone': timezone,
        },
      );
      return PostDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to schedule post');
    }
  }

  Future<PostDto> crossPost(
    String id, {
    required List<String> channelIds,
    String? textOverride,
  }) async {
    try {
      final res = await _client.dio.post(
        '/posts/$id/cross-post',
        data: {
          'channelIds': channelIds,
          if (textOverride != null && textOverride.isNotEmpty) 'textOverride': textOverride,
        },
      );
      return PostDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to cross-post');
    }
  }

  Future<PostDto> cancelPost(String id) async {
    try {
      final res = await _client.dio.post('/posts/$id/cancel');
      return PostDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to cancel post');
    }
  }

  Future<PostDto> cancelSchedule(String id) => cancelPost(id);

  Future<PostDto> retryPost(String id) async {
    try {
      final res = await _client.dio.post('/posts/$id/retry');
      return PostDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to retry post');
    }
  }

  // ---------- Posting Slots ----------

  Future<List<Map<String, dynamic>>> getSlots() async {
    try {
      final res = await _client.dio.get('/slots');
      return (res.data as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load posting slots');
    }
  }

  Future<Map<String, dynamic>> addSlot({required int weekday, required int minuteOfDay}) async {
    try {
      final res = await _client.dio.post('/slots', data: {
        'weekday': weekday,
        'minuteOfDay': minuteOfDay,
      });
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to add posting slot');
    }
  }

  Future<void> removeSlot(String id) async {
    try {
      await _client.dio.delete('/slots/$id');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to delete slot');
    }
  }

  Future<({String localDateTime, String timezone})> getNextFreeSlot() async {
    try {
      final res = await _client.dio.get('/slots/next-free');
      final data = res.data as Map<String, dynamic>;
      return (
        localDateTime: data['localDateTime'] as String,
        timezone: data['timezone'] as String,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to get next free slot');
    }
  }
}
