class UserModel {
  final String id;
  final String email;
  final String name;
  final String timezone;
  final bool xPremium;
  final String? brandVoice;
  final String? aiProvider;
  final String? aiModel;
  final DateTime createdAt;

  UserModel({
    required this.id,
    required this.email,
    required this.name,
    required this.timezone,
    this.xPremium = false,
    this.brandVoice,
    this.aiProvider,
    this.aiModel,
    required this.createdAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] as String,
        email: json['email'] as String? ?? '',
        name: json['name'] as String? ?? '',
        timezone: json['timezone'] as String? ?? 'UTC',
        xPremium: json['xPremium'] as bool? ?? false,
        brandVoice: json['brandVoice'] as String?,
        aiProvider: json['aiProvider'] as String?,
        aiModel: json['aiModel'] as String?,
        createdAt: json['createdAt'] != null
            ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
            : DateTime.now(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'timezone': timezone,
        'xPremium': xPremium,
        'brandVoice': brandVoice,
        'aiProvider': aiProvider,
        'aiModel': aiModel,
        'createdAt': createdAt.toIso8601String(),
      };
}
