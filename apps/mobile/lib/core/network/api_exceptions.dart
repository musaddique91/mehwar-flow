class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic details;

  ApiException(this.message, {this.statusCode, this.details});

  @override
  String toString() => message;
}

class UnauthorizedException extends ApiException {
  UnauthorizedException([super.message = 'Unauthorized']) : super(statusCode: 401);
}

class NetworkException extends ApiException {
  NetworkException([super.message = 'Network connection failed']) : super(statusCode: 0);
}
