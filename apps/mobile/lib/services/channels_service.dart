import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/network/api_exceptions.dart';
import '../models/channel_model.dart';

class ChannelsService {
  final ApiClient _client = ApiClient();

  Future<List<ChannelDto>> getChannels() async {
    try {
      final res = await _client.dio.get('/channels');
      return (res.data as List? ?? [])
          .map((e) => ChannelDto.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException(e.message ?? 'Failed to load channels', statusCode: e.response?.statusCode);
    }
  }

  Future<List<String>> getAvailablePlatforms() async {
    try {
      final res = await _client.dio.get('/channels/available');
      return (res.data as List? ?? []).map((e) => e.toString()).toList();
    } on DioException catch (e) {
      throw ApiException(e.message ?? 'Failed to load available platforms', statusCode: e.response?.statusCode);
    }
  }

  Future<void> removeChannel(String id) async {
    try {
      await _client.dio.delete('/channels/$id');
    } on DioException catch (e) {
      throw ApiException(e.message ?? 'Failed to remove channel', statusCode: e.response?.statusCode);
    }
  }

  /// Returns the OAuth URL the user should open in a browser to authorize a platform.
  Future<String?> getAuthUrl(String platform) async {
    try {
      final res = await _client.dio.get('/channels/$platform/auth-url');
      final data = res.data;
      if (data is Map) {
        return data['url'] as String? ?? data['authUrl'] as String?;
      }
      if (data is String) return data;
      return null;
    } on DioException catch (e) {
      throw ApiException(e.message ?? 'Failed to get auth URL', statusCode: e.response?.statusCode);
    }
  }
}
