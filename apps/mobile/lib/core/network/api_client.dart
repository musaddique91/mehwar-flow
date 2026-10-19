import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  static const String tokenKey = 'mehwar_token';
  static const String refreshTokenKey = 'mehwar_refresh_token';

  Completer<String?>? _refreshCompleter;
  void Function()? onSessionExpired;

  ApiClient._internal() {
    dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Client': 'mobile',
      },
    ));

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // AI endpoints can take longer to stream or process
          if (options.path.contains('/ai/')) {
            options.connectTimeout = const Duration(seconds: 120);
            options.receiveTimeout = const Duration(seconds: 120);
          }

          if (!options.path.startsWith('http://') && !options.path.startsWith('https://')) {
            final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
            final cleanPath = options.path.startsWith('/') ? options.path : '/${options.path}';
            options.path = '$base$cleanPath';
          }
          final token = await _storage.read(key: tokenKey);
          if (token != null && !options.headers.containsKey('Authorization')) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          if (error.response?.statusCode == 401 && !error.requestOptions.path.contains('/auth/')) {
            final refreshed = await _refreshToken();
            if (refreshed != null) {
              error.requestOptions.headers['Authorization'] = 'Bearer $refreshed';
              try {
                final retryResponse = await dio.fetch(error.requestOptions);
                return handler.resolve(retryResponse);
              } catch (e) {
                return handler.next(error);
              }
            } else {
              onSessionExpired?.call();
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  Future<void> saveTokens({required String accessToken, String? refreshToken}) async {
    await _storage.write(key: tokenKey, value: accessToken);
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await _storage.write(key: refreshTokenKey, value: refreshToken);
    }
  }

  Future<void> saveToken(String token) async {
    await _storage.write(key: tokenKey, value: token);
  }

  Future<String?> getToken() async {
    return await _storage.read(key: tokenKey);
  }

  Future<String?> getRefreshToken() async {
    return await _storage.read(key: refreshTokenKey);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: tokenKey);
    await _storage.delete(key: refreshTokenKey);
  }

  Future<void> clearToken() async {
    await clearTokens();
  }

  /// Single-flight token refresh to prevent racing on parallel 401 responses.
  Future<String?> _refreshToken() async {
    if (_refreshCompleter != null) {
      return _refreshCompleter!.future;
    }
    _refreshCompleter = Completer<String?>();

    try {
      final storedRefreshToken = await getRefreshToken();
      if (storedRefreshToken == null || storedRefreshToken.isEmpty) {
        await clearTokens();
        _refreshCompleter!.complete(null);
        return null;
      }

      final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
      final res = await Dio().post(
        '$base/auth/refresh',
        data: {'refreshToken': storedRefreshToken},
        options: Options(
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Client': 'mobile',
            'X-Refresh-Token': storedRefreshToken,
          },
          validateStatus: (status) => status != null && status < 500,
        ),
      );

      if (res.statusCode == 200 && res.data != null && res.data['accessToken'] != null) {
        final newAccessToken = res.data['accessToken'] as String;
        final newRefreshToken = res.data['refreshToken'] as String?;
        await saveTokens(
          accessToken: newAccessToken,
          refreshToken: newRefreshToken ?? storedRefreshToken,
        );
        _refreshCompleter!.complete(newAccessToken);
        return newAccessToken;
      } else {
        await clearTokens();
        _refreshCompleter!.complete(null);
        return null;
      }
    } catch (_) {
      await clearTokens();
      _refreshCompleter!.complete(null);
      return null;
    } finally {
      _refreshCompleter = null;
    }
  }
}

