import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  static const String tokenKey = 'mehwar_token';

  ApiClient._internal() {
    dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    ));

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
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
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  Future<void> saveToken(String token) async {
    await _storage.write(key: tokenKey, value: token);
  }

  Future<String?> getToken() async {
    return await _storage.read(key: tokenKey);
  }

  Future<void> clearToken() async {
    await _storage.delete(key: tokenKey);
  }

  Future<String?> _refreshToken() async {
    try {
      final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
      final res = await Dio().post('$base/auth/refresh');
      if (res.statusCode == 200 && res.data != null && res.data['accessToken'] != null) {
        final newToken = res.data['accessToken'] as String;
        await saveToken(newToken);
        return newToken;
      }
    } catch (_) {
      await clearToken();
    }
    return null;
  }
}
