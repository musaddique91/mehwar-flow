import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/network/api_exceptions.dart';

class AccountService {
  final ApiClient _client = ApiClient();

  Future<String> exportAccountData() async {
    try {
      final res = await _client.dio.get<String>(
        '/me/export',
        options: Options(responseType: ResponseType.plain),
      );
      return res.data ?? '{}';
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to export account data');
    }
  }

  Future<String> exportData() => exportAccountData();

  Future<void> deleteAccount({String? password}) async {
    try {
      await _client.dio.delete('/me', data: {'password': password ?? ''});
      await _client.clearTokens();
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to delete account');
    }
  }
}
