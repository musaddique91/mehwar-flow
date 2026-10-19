import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/network/api_exceptions.dart';
import '../models/customer_model.dart';

class CustomersService {
  final ApiClient _client = ApiClient();

  Future<List<CustomerDto>> getCustomers({String? query}) async {
    try {
      final res = await _client.dio.get(
        '/customers',
        queryParameters: query != null && query.isNotEmpty ? {'q': query} : null,
      );
      return (res.data as List? ?? [])
          .map((e) => CustomerDto.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load customers');
    }
  }

  Future<List<CustomerDto>> listCustomers({String? query}) => getCustomers(query: query);

  Future<CustomerDto> createCustomer({
    required String name,
    String? phone,
    String? mobileNumber,
    String? whatsappNumber,
    String? email,
    String? notes,
    List<String>? groupIds,
  }) async {
    try {
      final mobile = mobileNumber ?? phone ?? '';
      final res = await _client.dio.post('/customers', data: {
        'name': name,
        'mobileNumber': mobile,
        if (whatsappNumber != null && whatsappNumber.isNotEmpty) 'whatsappNumber': whatsappNumber,
        if (email != null && email.isNotEmpty) 'email': email,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (groupIds != null) 'groupIds': groupIds,
      });
      return CustomerDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to create customer');
    }
  }

  Future<CustomerDto> updateCustomer(
    String id, {
    String? name,
    String? phone,
    String? mobileNumber,
    String? whatsappNumber,
    String? email,
    String? notes,
    List<String>? groupIds,
    Map<String, dynamic>? data,
  }) async {
    try {
      final payload = data ?? {
        if (name != null) 'name': name,
        if (mobileNumber != null || phone != null) 'mobileNumber': mobileNumber ?? phone,
        if (whatsappNumber != null) 'whatsappNumber': whatsappNumber,
        if (email != null) 'email': email,
        if (notes != null) 'notes': notes,
        if (groupIds != null) 'groupIds': groupIds,
      };
      final res = await _client.dio.patch('/customers/$id', data: payload);
      return CustomerDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to update customer');
    }
  }

  Future<void> deleteCustomer(String id) async {
    try {
      await _client.dio.delete('/customers/$id');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to delete customer');
    }
  }

  // ---------- Groups ----------

  Future<List<CustomerGroupDto>> getGroups() async {
    try {
      final res = await _client.dio.get('/customers/groups');
      return (res.data as List? ?? [])
          .map((e) => CustomerGroupDto.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to load groups');
    }
  }

  Future<List<CustomerGroupDto>> listGroups() => getGroups();

  Future<CustomerGroupDto> createGroup({
    required String name,
    String? description,
    List<String>? customerIds,
  }) async {
    try {
      final res = await _client.dio.post('/customers/groups', data: {
        'name': name,
        if (description != null && description.isNotEmpty) 'description': description,
        if (customerIds != null) 'customerIds': customerIds,
      });
      return CustomerGroupDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to create customer group');
    }
  }

  Future<CustomerGroupDto> updateGroup(
    String id, {
    String? name,
    String? description,
    List<String>? customerIds,
    Map<String, dynamic>? data,
  }) async {
    try {
      final payload = data ?? {
        if (name != null) 'name': name,
        if (description != null) 'description': description,
        if (customerIds != null) 'customerIds': customerIds,
      };
      final res = await _client.dio.patch('/customers/groups/$id', data: payload);
      return CustomerGroupDto.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to update customer group');
    }
  }

  Future<void> deleteGroup(String id) async {
    try {
      await _client.dio.delete('/customers/groups/$id');
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to delete customer group');
    }
  }

  // ---------- Share Post to Customers ----------

  Future<SharePostResult> sharePostToCustomers({
    required String postId,
    List<String>? customerIds,
    List<String>? groupIds,
    required List<String> channels, // 'EMAIL', 'WHATSAPP'
    String? customMessage,
  }) async {
    try {
      final res = await _client.dio.post('/customers/share-post', data: {
        'postId': postId,
        if (customerIds != null) 'customerIds': customerIds,
        if (groupIds != null) 'groupIds': groupIds,
        'channels': channels,
        if (customMessage != null && customMessage.isNotEmpty) 'customMessage': customMessage,
      });
      return SharePostResult.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e, 'Failed to share post to customers');
    }
  }

  Future<SharePostResult> sharePost(
    String postId, {
    List<String>? groupIds,
    List<String>? customerIds,
    String? customMessage,
  }) {
    return sharePostToCustomers(
      postId: postId,
      groupIds: groupIds,
      customerIds: customerIds,
      channels: ['WHATSAPP'],
      customMessage: customMessage,
    );
  }
}
