import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/network/api_exceptions.dart';
import '../models/automation_model.dart';

class AutomationService {
  final ApiClient _client = ApiClient();

  Future<AutomationOverviewDto> getOverview() async {
    try {
      final res = await _client.dio.get('/automation/overview');
      return AutomationOverviewDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load automation overview');
    }
  }

  Future<List<SchedulerConfigDto>> getSchedulers() async {
    try {
      final res = await _client.dio.get('/automation/schedulers');
      return (res.data as List? ?? [])
          .map((e) => SchedulerConfigDto.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load schedulers');
    }
  }

  Future<SchedulerConfigDto> updateScheduler(String id, Map<String, dynamic> data) async {
    try {
      final res = await _client.dio.patch('/automation/schedulers/$id', data: data);
      return SchedulerConfigDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to update scheduler');
    }
  }

  Future<void> runScheduler(String id) async {
    try {
      await _client.dio.post('/automation/schedulers/$id/run');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to trigger scheduler run');
    }
  }

  Future<List<SchedulerRunDto>> getRuns({int limit = 50}) async {
    try {
      final res = await _client.dio.get('/automation/runs', queryParameters: {'limit': limit});
      return (res.data as List? ?? [])
          .map((e) => SchedulerRunDto.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load execution runs');
    }
  }

  Future<List<OrderInquiryDto>> getLeads({String? status}) async {
    try {
      final res = await _client.dio.get(
        '/automation/leads',
        queryParameters: status != null && status.isNotEmpty ? {'status': status} : null,
      );
      return (res.data as List? ?? [])
          .map((e) => OrderInquiryDto.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load inquiries/leads');
    }
  }

  Future<OrderInquiryDto> updateLead(String id, Map<String, dynamic> data) async {
    try {
      final res = await _client.dio.patch('/automation/leads/$id', data: data);
      return OrderInquiryDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to update lead');
    }
  }

  // Backwards compatibility aliases
  Future<List<SchedulerConfigDto>> listSchedulers() => getSchedulers();
  Future<List<SchedulerRunDto>> listRuns({int limit = 50}) => getRuns(limit: limit);
  Future<List<OrderInquiryDto>> listLeads({String? status}) => getLeads(status: status);
  Future<SchedulerConfigDto> toggleScheduler(String id, bool enabled) =>
      updateScheduler(id, {'enabled': enabled});
  Future<void> triggerRun(String id) => runScheduler(id);
  Future<OrderInquiryDto> updateLeadStatus(String id, String status) =>
      updateLead(id, {'status': status});
}
