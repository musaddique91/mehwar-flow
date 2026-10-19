class CustomerGroupSummary {
  final String id;
  final String name;

  CustomerGroupSummary({required this.id, required this.name});

  factory CustomerGroupSummary.fromJson(Map<String, dynamic> json) => CustomerGroupSummary(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {'id': id, 'name': name};
}

class CustomerDto {
  final String id;
  final String name;
  final String mobileNumber;
  final String whatsappNumber;
  final String? email;
  final String? notes;
  final String createdAt;
  final String updatedAt;
  final List<CustomerGroupSummary> groups;

  CustomerDto({
    required this.id,
    required this.name,
    required this.mobileNumber,
    required this.whatsappNumber,
    this.email,
    this.notes,
    required this.createdAt,
    required this.updatedAt,
    this.groups = const [],
  });

  factory CustomerDto.fromJson(Map<String, dynamic> json) => CustomerDto(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        mobileNumber: json['mobileNumber'] as String? ?? '',
        whatsappNumber: json['whatsappNumber'] as String? ?? json['mobileNumber'] as String? ?? '',
        email: json['email'] as String?,
        notes: json['notes'] as String?,
        createdAt: json['createdAt'] as String? ?? '',
        updatedAt: json['updatedAt'] as String? ?? '',
        groups: (json['groups'] as List? ?? [])
            .map((e) => CustomerGroupSummary.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  String get phone => mobileNumber.isNotEmpty ? mobileNumber : whatsappNumber;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'mobileNumber': mobileNumber,
        'whatsappNumber': whatsappNumber,
        'email': email,
        'notes': notes,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };
}

class CustomerGroupDto {
  final String id;
  final String name;
  final String? description;
  final int memberCount;
  final String createdAt;

  CustomerGroupDto({
    required this.id,
    required this.name,
    this.description,
    this.memberCount = 0,
    required this.createdAt,
  });

  factory CustomerGroupDto.fromJson(Map<String, dynamic> json) => CustomerGroupDto(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
        memberCount: (json['memberCount'] as num?)?.toInt() ?? 0,
        createdAt: json['createdAt'] as String? ?? '',
      );

  int get customerCount => memberCount;
}

class SharePostResult {
  final bool success;
  final int recipientCount;
  final int emailsSent;
  final int emailsFailed;
  final int whatsappSent;
  final int whatsappFailed;
  final int? whatsappQueued;
  final String message;

  SharePostResult({
    required this.success,
    required this.recipientCount,
    this.emailsSent = 0,
    this.emailsFailed = 0,
    this.whatsappSent = 0,
    this.whatsappFailed = 0,
    this.whatsappQueued,
    required this.message,
  });

  factory SharePostResult.fromJson(Map<String, dynamic> json) => SharePostResult(
        success: json['success'] as bool? ?? true,
        recipientCount: (json['recipientCount'] as num?)?.toInt() ?? 0,
        emailsSent: (json['emailsSent'] as num?)?.toInt() ?? 0,
        emailsFailed: (json['emailsFailed'] as num?)?.toInt() ?? 0,
        whatsappSent: (json['whatsappSent'] as num?)?.toInt() ?? 0,
        whatsappFailed: (json['whatsappFailed'] as num?)?.toInt() ?? 0,
        whatsappQueued: (json['whatsappQueued'] as num?)?.toInt(),
        message: json['message'] as String? ?? 'Post shared successfully',
      );

  int get sentCount => recipientCount;
}
