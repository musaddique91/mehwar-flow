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
      final refreshToken = res.data['refreshToken'] as String?;
      final user = UserModel.fromJson(res.data['user'] as Map<String, dynamic>);
      await _client.saveTokens(accessToken: token, refreshToken: refreshToken);
      return (token: token, user: user);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Login failed');
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
      final refreshToken = res.data['refreshToken'] as String?;
      final user = UserModel.fromJson(res.data['user'] as Map<String, dynamic>);
      await _client.saveTokens(accessToken: token, refreshToken: refreshToken);
      return (token: token, user: user);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Registration failed');
    }
  }

  Future<UserModel> getMe() async {
    try {
      final res = await _client.dio.get('/auth/me');
      return UserModel.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to fetch current user');
    }
  }

  Future<UserModel> updateProfile(Map<String, dynamic> data) async {
    try {
      final res = await _client.dio.patch('/me', data: data);
      return UserModel.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Profile update failed');
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      await _client.dio.post('/me/password', data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to change password');
    }
  }

  Future<void> logout() async {
    try {
      final rt = await _client.getRefreshToken();
      await _client.dio.post(
        '/auth/logout',
        data: {'refreshToken': rt},
      );
    } catch (_) {}
    await _client.clearTokens();
  }
}

