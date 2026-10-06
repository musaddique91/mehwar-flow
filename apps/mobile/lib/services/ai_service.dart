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
      final res = await _client.dio.post(
        '/ai/hashtags',
        data: {'text': text, 'platform': platform},
      );
      if (res.data is Map && res.data['hashtags'] is List) {
        return (res.data['hashtags'] as List).map((e) => e.toString()).toList();
      }
      if (res.data is List) {
        return (res.data as List).map((e) => e.toString()).toList();
      }
      return [];
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'Hashtag generation failed';
      throw ApiException(msg is List ? msg.join(', ') : msg.toString(), statusCode: e.response?.statusCode);
    }
  }
}
