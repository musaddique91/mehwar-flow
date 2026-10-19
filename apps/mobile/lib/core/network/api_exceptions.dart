import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic details;

  ApiException(this.message, {this.statusCode, this.details});

  @override
  String toString() => message;

  factory ApiException.fromDio(DioException error, [String fallback = 'An unexpected error occurred']) {
    final status = error.response?.statusCode;
    final data = error.response?.data;
    String? msg;
    dynamic details;

    if (data is Map) {
      final rawMsg = data['message'] ?? data['error'];
      if (rawMsg is List) {
        msg = rawMsg.map((e) => e.toString()).join('\n');
      } else if (rawMsg != null) {
        msg = rawMsg.toString();
      }
      details = data['details'];
    }

    final finalMsg = msg ?? error.message ?? fallback;

    if (status == 401) {
      return UnauthorizedException(finalMsg);
    }
    if (status == 402 || (status == 403 && (finalMsg.toLowerCase().contains('limit') || finalMsg.toLowerCase().contains('upgrade') || finalMsg.toLowerCase().contains('plan')))) {
      return PlanLimitException(finalMsg, statusCode: status, details: details);
    }
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.connectionError) {
      return NetworkException(finalMsg);
    }

    return ApiException(finalMsg, statusCode: status, details: details);
  }
}

class UnauthorizedException extends ApiException {
  UnauthorizedException([super.message = 'Unauthorized']) : super(statusCode: 401);
}

class PlanLimitException extends ApiException {
  PlanLimitException(super.message, {super.statusCode, super.details});
}

class NetworkException extends ApiException {
  NetworkException([super.message = 'Network connection failed']) : super(statusCode: 0);
}

