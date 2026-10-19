import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/network/api_exceptions.dart';
import '../models/billing_model.dart';

class BillingService {
  final ApiClient _client = ApiClient();

  Future<BillingOverviewDto> getOverview() async {
    try {
      final res = await _client.dio.get('/billing');
      return BillingOverviewDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load billing overview');
    }
  }

  Future<String> createCheckoutSession(String plan) async {
    try {
      final res = await _client.dio.post('/billing/checkout', data: {'plan': plan});
      final data = res.data;
      if (data is Map && data['url'] != null) {
        return data['url'] as String;
      }
      throw ApiException('Checkout URL not returned');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to create checkout session');
    }
  }

  Future<String> createCustomerPortalSession() async {
    try {
      final res = await _client.dio.post('/billing/portal');
      final data = res.data;
      if (data is Map && data['url'] != null) {
        return data['url'] as String;
      }
      throw ApiException('Customer portal URL not returned');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to open billing portal');
    }
  }

  Future<String> createPortalSession() => createCustomerPortalSession();
}
