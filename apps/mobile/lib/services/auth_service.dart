import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/network/api_exceptions.dart';
import '../models/user_model.dart';

class AuthService {
  final ApiClient _client = ApiClient();

  Future<({String token, UserModel user})> login({
    required String email,
    required String password,
  }) async {
    try {
      final res = await _client.dio.post(
        '/auth/login',
        data: {'email': email.trim(), 'password': password},
      );
      final token = res.data['accessToken'] as String;
      final user = UserModel.fromJson(res.data['user'] as Map<String, dynamic>);
      await _client.saveToken(token);
      return (token: token, user: user);
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'Login failed';
      throw ApiException(msg is List ? msg.join(', ') : msg.toString(), statusCode: e.response?.statusCode);
    }
  }

  Future<({String token, UserModel user})> register({
    required String email,
    required String password,
    required String name,
    String timezone = 'UTC',
  }) async {
    try {
      final res = await _client.dio.post(
        '/auth/register',
        data: {
          'email': email.trim(),
          'password': password,
          'name': name.trim(),
          'timezone': timezone,
        },
      );
      final token = res.data['accessToken'] as String;
      final user = UserModel.fromJson(res.data['user'] as Map<String, dynamic>);
      await _client.saveToken(token);
      return (token: token, user: user);
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'Registration failed';
      throw ApiException(msg is List ? msg.join(', ') : msg.toString(), statusCode: e.response?.statusCode);
    }
  }

  Future<UserModel> getMe() async {
    try {
      final res = await _client.dio.get('/auth/me');
      return UserModel.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) throw UnauthorizedException();
      throw ApiException(e.message ?? 'Failed to fetch current user', statusCode: e.response?.statusCode);
    }
  }

  Future<UserModel> updateProfile(Map<String, dynamic> data) async {
    try {
      final res = await _client.dio.patch('/me', data: data);
      return UserModel.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? e.message ?? 'Profile update failed';
      throw ApiException(msg is List ? msg.join(', ') : msg.toString(), statusCode: e.response?.statusCode);
    }
  }

  Future<void> logout() async {
    try {
      await _client.dio.post('/auth/logout');
    } catch (_) {}
    await _client.clearToken();
  }
}
