import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/network/api_exceptions.dart';
import '../models/notification_model.dart';

class NotificationsService {
  final ApiClient _client = ApiClient();

  Future<List<NotificationDto>> getNotifications() async {
    try {
      final res = await _client.dio.get('/notifications');
      return (res.data as List? ?? [])
          .map((e) => NotificationDto.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load notifications');
    }
  }

  Future<List<NotificationDto>> listNotifications() => getNotifications();

  Future<void> markAllRead() async {
    try {
      await _client.dio.post('/notifications/read');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to mark notifications as read');
    }
  }

  Future<void> markRead([String? id]) async {
    if (id != null) {
      try {
        await _client.dio.patch('/notifications/$id/read');
        return;
      } on DioException {
        // Fall back to markAllRead if single endpoint is not supported
      }
    }
    return markAllRead();
  }
}
