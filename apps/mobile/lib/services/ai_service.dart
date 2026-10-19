import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/network/api_exceptions.dart';

class AiCaptionResult {
  final String platform;
  final String text;
  final List<String> hashtags;

  AiCaptionResult({
    required this.platform,
    required this.text,
    required this.hashtags,
  });

  factory AiCaptionResult.fromJson(Map<String, dynamic> json) => AiCaptionResult(
        platform: json['platform'] as String? ?? '',
        text: json['text'] as String? ?? '',
        hashtags: (json['hashtags'] as List? ?? []).map((e) => e.toString()).toList(),
      );
}

class AiService {
  final ApiClient _client = ApiClient();

  Future<List<AiCaptionResult>> generateCaptions({
    required String prompt,
    required List<String> platforms,
    String? tone,
  }) async {
    try {
      final res = await _client.dio.post(
        '/ai/caption',
        data: {
          'prompt': prompt,
          'platforms': platforms.isEmpty ? ['x'] : platforms,
          if (tone != null) 'tone': tone,
        },
      );
      return (res.data as List? ?? [])
          .map((e) => AiCaptionResult.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'AI Caption generation failed';
      throw ApiException(msg is List ? msg.join(', ') : msg.toString(), statusCode: e.response?.statusCode);
    }
  }

  Future<String> rewrite({
    required String text,
    required String platform,
    required String instruction,
  }) async {
    try {
      final res = await _client.dio.post(
        '/ai/rewrite',
        data: {
          'text': text,
          'platform': platform,
          'instruction': instruction,
        },
      );
      if (res.data is Map && res.data['text'] != null) {
        return res.data['text'] as String;
      }
      return res.data.toString();
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'AI Rewrite failed';
      throw ApiException(msg is List ? msg.join(', ') : msg.toString(), statusCode: e.response?.statusCode);
    }
  }

  Future<List<String>> generateHashtags({
    required String text,
    required String platform,
  }) async {
    try {
      final res = await _client.dio.post('/ai/hashtags', data: {
        'text': text,
        'platform': platform,
      });
      final data = res.data;
      if (data is Map && data['hashtags'] is List) {
        return (data['hashtags'] as List).map((e) => e.toString()).toList();
      }
      if (data is List) return data.map((e) => e.toString()).toList();
      return [];
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to generate hashtags');
    }
  }

  Future<Map<String, dynamic>> getStatus() async {
    try {
      final res = await _client.dio.get('/ai/status');
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to fetch AI status');
    }
  }

  Future<Map<String, dynamic>> getSettings() async {
    try {
      final res = await _client.dio.get('/ai/settings');
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to fetch AI settings');
    }
  }

  Future<Map<String, dynamic>> updateSettings({
    String? provider,
    String? apiKey,
    String? model,
    Map<String, dynamic>? data,
  }) async {
    try {
      final payload = data ?? {
        if (provider != null) 'provider': provider,
        if (apiKey != null) 'apiKey': apiKey,
        if (model != null) 'model': model,
      };
      final res = await _client.dio.post('/ai/settings', data: payload);
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to update AI settings');
    }
  }

  Future<Map<String, dynamic>> testConnection({
    String? provider,
    String? apiKey,
    String? model,
    Map<String, dynamic>? data,
  }) async {
    try {
      final payload = data ?? {
        if (provider != null) 'provider': provider,
        if (apiKey != null) 'apiKey': apiKey,
        if (model != null) 'model': model,
      };
      final res = await _client.dio.post('/ai/test-connection', data: payload);
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to test AI connection');
    }
  }

  Future<List<String>> generateIdeas({
    required String topic,
    String? platform,
    int? count,
  }) async {
    try {
      final res = await _client.dio.post('/ai/ideas', data: {
        'topic': topic,
        if (platform != null) 'platform': platform,
        if (count != null) 'count': count,
      });
      final data = res.data;
      if (data is Map && data['ideas'] is List) {
        return (data['ideas'] as List).map((e) => e.toString()).toList();
      }
      if (data is List) return data.map((e) => e.toString()).toList();
      return [];
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to generate post ideas');
    }
  }

  Future<List<String>> generateHooks({
    required String text,
    int? count,
  }) async {
    try {
      final res = await _client.dio.post('/ai/hooks', data: {
        'text': text,
        if (count != null) 'count': count,
      });
      final data = res.data;
      if (data is Map && data['hooks'] is List) {
        return (data['hooks'] as List).map((e) => e.toString()).toList();
      }
      if (data is List) return data.map((e) => e.toString()).toList();
      return [];
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to generate hooks');
    }
  }

  Future<String> generateAltText(String mediaId) async {
    try {
      final res = await _client.dio.post('/ai/alt-text', data: {'mediaId': mediaId});
      final data = res.data;
      if (data is Map && data['altText'] != null) {
        return data['altText'] as String;
      }
      return data.toString();
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to generate alt text');
    }
  }

  Future<Map<String, dynamic>> analyzeComments({
    required List<Map<String, dynamic>> comments,
    String? videoTitle,
    String? videoDescription,
  }) async {
    try {
      final res = await _client.dio.post('/ai/analyze-comments', data: {
        'comments': comments,
        if (videoTitle != null) 'videoTitle': videoTitle,
        if (videoDescription != null) 'videoDescription': videoDescription,
      });
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to analyze comments');
    }
  }
}
