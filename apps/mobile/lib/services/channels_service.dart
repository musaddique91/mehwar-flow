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
      throw ApiException.fromDio(e, 'Failed to load channels');
    }
  }

  Future<List<AvailablePlatform>> getAvailablePlatforms() async {
    try {
      final res = await _client.dio.get('/channels/available');
      return (res.data as List? ?? [])
          .map((e) => AvailablePlatform.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load available platforms');
    }
  }

  Future<void> removeChannel(String id) async {
    try {
      await _client.dio.delete('/channels/$id');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to remove channel');
    }
  }

  /// Request authorization URL to connect a platform via mobile client
  Future<String> startConnect(String platform) async {
    try {
      final res = await _client.dio.post(
        '/channels/connect/$platform',
        queryParameters: {'client': 'mobile'},
      );
      final data = res.data;
      if (data is Map && data['url'] != null) {
        return data['url'] as String;
      }
      throw ApiException('Invalid connect URL returned');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to start channel connect');
    }
  }

  // Backwards compatibility alias
  Future<String?> getAuthUrl(String platform) => startConnect(platform);

  Future<ChannelDetailDto> getChannelDetails(String id) async {
    try {
      final res = await _client.dio.get('/channels/$id/details');
      return ChannelDetailDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load channel details');
    }
  }

  Future<ChannelDetailDto> getChannelDetail(String id) => getChannelDetails(id);

  Future<List<PendingAccount>> getPendingAccounts(String session) async {
    try {
      final res = await _client.dio.get('/channels/pending/$session');
      final data = res.data;
      final accounts = (data is Map ? data['accounts'] : null) as List? ?? [];
      return accounts.map((e) => PendingAccount.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load pending accounts');
    }
  }

  Future<void> selectPendingAccounts(String session, List<String> externalIds) async {
    try {
      await _client.dio.post(
        '/channels/pending/$session',
        data: {'externalIds': externalIds},
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to select accounts');
    }
  }

  Future<void> completePendingAccounts(String session, List<String> externalIds) =>
      selectPendingAccounts(session, externalIds);

  Future<WhatsAppStatus> getWhatsAppQr() => connectWhatsApp();

  // ---------- Comments Inbox ----------

  Future<({List<CommentDto> comments, int total, bool hasMore})> getAllComments({
    String? channelId,
    int? page,
    int? limit,
    String? platform,
    bool? refresh,
  }) async {
    try {
      final query = <String, dynamic>{};
      if (channelId != null) query['channelId'] = channelId;
      if (page != null) query['page'] = page;
      if (limit != null) query['limit'] = limit;
      if (platform != null && platform != 'all') query['platform'] = platform;
      if (refresh == true) query['refresh'] = 'true';

      final res = await _client.dio.get('/channels/all-comments', queryParameters: query);
      final data = res.data as Map<String, dynamic>;
      final comments = (data['comments'] as List? ?? [])
          .map((e) => CommentDto.fromJson(e as Map<String, dynamic>))
          .toList();
      return (
        comments: comments,
        total: (data['total'] as num?)?.toInt() ?? comments.length,
        hasMore: data['hasMore'] as bool? ?? false,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load comments');
    }
  }

  Future<List<CommentDto>> getVideoComments(String channelId, String videoId) async {
    try {
      final res = await _client.dio.get('/channels/$channelId/videos/$videoId/comments');
      return (res.data as List? ?? [])
          .map((e) => CommentDto.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load video comments');
    }
  }

  Future<void> replyToComment(
    String channelId,
    String videoId, {
    required String text,
    String? parentId,
  }) async {
    try {
      await _client.dio.post(
        '/channels/$channelId/videos/$videoId/comments',
        data: {
          'text': text,
          if (parentId != null) 'parentId': parentId,
        },
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to reply to comment');
    }
  }

  Future<void> deleteComment(String channelId, String videoId, String commentId) async {
    try {
      await _client.dio.delete('/channels/$channelId/videos/$videoId/comments/$commentId');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to delete comment');
    }
  }

  Future<void> likePost(String channelId, String videoId) async {
    try {
      await _client.dio.post('/channels/$channelId/videos/$videoId/like');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to like post');
    }
  }

  Future<void> retweetPost(String channelId, String videoId) async {
    try {
      await _client.dio.post('/channels/$channelId/videos/$videoId/retweet');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to retweet post');
    }
  }

  // ---------- WhatsApp ----------

  Future<WhatsAppStatus> getWhatsAppStatus() async {
    try {
      final res = await _client.dio.get('/whatsapp/status');
      return WhatsAppStatus.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load WhatsApp status');
    }
  }

  Future<WhatsAppStatus> connectWhatsApp() async {
    try {
      final res = await _client.dio.post('/whatsapp/connect');
      return WhatsAppStatus.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to connect WhatsApp');
    }
  }

  Future<void> disconnectWhatsApp() async {
    try {
      await _client.dio.post('/whatsapp/disconnect');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to disconnect WhatsApp');
    }
  }

  Future<void> setWhatsAppProfileStatus(String status) async {
    try {
      await _client.dio.post('/whatsapp/status/profile', data: {'status': status});
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to set WhatsApp profile status');
    }
  }
}

