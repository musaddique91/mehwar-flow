import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import '../core/config/app_config.dart';
import '../core/network/api_client.dart';

class LiveEvent {
  final String type;
  final dynamic payload;

  LiveEvent({required this.type, this.payload});

  factory LiveEvent.fromJson(Map<String, dynamic> json) => LiveEvent(
        type: json['type'] as String? ?? '',
        payload: json['payload'],
      );
}

class EventsService {
  static final EventsService _instance = EventsService._internal();
  factory EventsService() => _instance;
  EventsService._internal();

  final ApiClient _client = ApiClient();
  final _controller = StreamController<LiveEvent>.broadcast();
  CancelToken? _cancelToken;
  bool _isConnected = false;

  Stream<LiveEvent> get stream => _controller.stream;
  bool get isConnected => _isConnected;

  void startListening() {
    if (_isConnected) return;
    _connect();
  }

  void stopListening() {
    _cancelToken?.cancel();
    _cancelToken = null;
    _isConnected = false;
  }

  Future<void> _connect() async {
    final token = await _client.getToken();
    if (token == null) return;

    _cancelToken = CancelToken();
    _isConnected = true;

    try {
      final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
      final response = await Dio().get<ResponseBody>(
        '$base/events',
        options: Options(
          responseType: ResponseType.stream,
          headers: {
            'Authorization': 'Bearer $token',
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        ),
        cancelToken: _cancelToken,
      );

      final stream = response.data?.stream;
      if (stream == null) {
        _isConnected = false;
        return;
      }

      StringBuffer buffer = StringBuffer();
      await for (final chunk in stream.cast<List<int>>().transform(utf8.decoder)) {
        buffer.write(chunk);
        final lines = buffer.toString().split('\n');
        buffer = StringBuffer(lines.removeLast());

        for (final line in lines) {
          final trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            final dataStr = trimmed.substring(5).trim();
            if (dataStr.isNotEmpty) {
              try {
                final json = jsonDecode(dataStr);
                if (json is Map<String, dynamic>) {
                  _controller.add(LiveEvent.fromJson(json));
                }
              } catch (_) {}
            }
          }
        }
      }
    } catch (_) {
      // Reconnect with backoff if not deliberately cancelled
      if (_isConnected && _cancelToken?.isCancelled != true) {
        Future.delayed(const Duration(seconds: 5), () {
          if (_isConnected) _connect();
        });
      }
    } finally {
      _isConnected = false;
    }
  }
}
