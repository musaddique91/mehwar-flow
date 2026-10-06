import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/network/api_exceptions.dart';
import '../models/analytics_model.dart';

class AnalyticsService {
  final ApiClient _client = ApiClient();

  Future<AnalyticsSummaryDto> getSummary({int days = 30}) async {
    try {
      final res = await _client.dio.get('/analytics/summary', queryParameters: {'days': days});
      return AnalyticsSummaryDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException(e.message ?? 'Failed to load analytics', statusCode: e.response?.statusCode);
    }
  }

  Future<AnalyticsSummaryDto> syncAnalytics({int days = 30}) async {
    try {
      final res = await _client.dio.post('/analytics/sync', queryParameters: {'days': days});
      return AnalyticsSummaryDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException(e.message ?? 'Failed to sync analytics', statusCode: e.response?.statusCode);
    }
  }
}
