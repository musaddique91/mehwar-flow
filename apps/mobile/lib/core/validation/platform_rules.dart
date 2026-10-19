import 'package:characters/characters.dart';

class PlatformRules {
  final String label;
  final int maxTextLength;
  final int? maxTextLengthExtended;
  final int? maxHashtags;
  final bool allowsTextOnly;
  final bool requiresVideo;
  final int maxImages;
  final int maxVideos;
  final bool allowsMixedMedia;
  final int? maxVideoDurationSec;
  final double? requiredAspectRatio;
  final String? requiredAspectRatioLabel;
  final bool linksNotClickable;
  final bool supportsThreads;

  const PlatformRules({
    required this.label,
    required this.maxTextLength,
    this.maxTextLengthExtended,
    this.maxHashtags,
    required this.allowsTextOnly,
    required this.requiresVideo,
    required this.maxImages,
    required this.maxVideos,
    required this.allowsMixedMedia,
    this.maxVideoDurationSec,
    this.requiredAspectRatio,
    this.requiredAspectRatioLabel,
    required this.linksNotClickable,
    required this.supportsThreads,
  });
}

const Map<String, PlatformRules> platformRules = {
  'x': PlatformRules(
    label: 'X',
    maxTextLength: 280,
    maxTextLengthExtended: 25000,
    allowsTextOnly: true,
    requiresVideo: false,
    maxImages: 4,
    maxVideos: 1,
    allowsMixedMedia: false,
    maxVideoDurationSec: 140,
    linksNotClickable: false,
    supportsThreads: true,
  ),
  'facebook': PlatformRules(
    label: 'Facebook',
    maxTextLength: 63206,
    allowsTextOnly: true,
    requiresVideo: false,
    maxImages: 10,
    maxVideos: 1,
    allowsMixedMedia: false,
    linksNotClickable: false,
    supportsThreads: false,
  ),
  'instagram': PlatformRules(
    label: 'Instagram',
    maxTextLength: 2200,
    maxHashtags: 30,
    allowsTextOnly: false,
    requiresVideo: false,
    maxImages: 10,
    maxVideos: 10,
    allowsMixedMedia: true,
    maxVideoDurationSec: 900,
    linksNotClickable: true,
    supportsThreads: false,
  ),
  'threads': PlatformRules(
    label: 'Threads',
    maxTextLength: 500,
    allowsTextOnly: true,
    requiresVideo: false,
    maxImages: 20,
    maxVideos: 20,
    allowsMixedMedia: true,
    maxVideoDurationSec: 300,
    linksNotClickable: false,
    supportsThreads: true,
  ),
  'youtube': PlatformRules(
    label: 'YouTube',
    maxTextLength: 100,
    allowsTextOnly: false,
    requiresVideo: true,
    maxImages: 0,
    maxVideos: 1,
    allowsMixedMedia: false,
    linksNotClickable: false,
    supportsThreads: false,
  ),
  'tiktok': PlatformRules(
    label: 'TikTok',
    maxTextLength: 2200,
    allowsTextOnly: false,
    requiresVideo: true,
    maxImages: 0,
    maxVideos: 1,
    allowsMixedMedia: false,
    maxVideoDurationSec: 600,
    linksNotClickable: true,
    supportsThreads: false,
  ),
  'snapchat': PlatformRules(
    label: 'Snapchat',
    maxTextLength: 250,
    allowsTextOnly: false,
    requiresVideo: false,
    maxImages: 1,
    maxVideos: 1,
    allowsMixedMedia: false,
    maxVideoDurationSec: 60,
    requiredAspectRatio: 9 / 16,
    requiredAspectRatioLabel: '9:16',
    linksNotClickable: true,
    supportsThreads: false,
  ),
  'linkedin': PlatformRules(
    label: 'LinkedIn',
    maxTextLength: 3000,
    allowsTextOnly: true,
    requiresVideo: false,
    maxImages: 9,
    maxVideos: 1,
    allowsMixedMedia: false,
    maxVideoDurationSec: 600,
    linksNotClickable: false,
    supportsThreads: false,
  ),
  'whatsapp': PlatformRules(
    label: 'WhatsApp',
    maxTextLength: 4096,
    allowsTextOnly: true,
    requiresVideo: false,
    maxImages: 10,
    maxVideos: 1,
    allowsMixedMedia: false,
    maxVideoDurationSec: 300,
    linksNotClickable: false,
    supportsThreads: false,
  ),
};

class ValidationIssue {
  final String platform;
  final String severity; // 'error' or 'warning'
  final String code;
  final String message;

  ValidationIssue({
    required this.platform,
    required this.severity,
    required this.code,
    required this.message,
  });

  bool get isError => severity == 'error';
  bool get isWarning => severity == 'warning';
}

List<ValidationIssue> validatePostForPlatform({
  required String platform,
  required String text,
  required int imageCount,
  required int videoCount,
  bool isExtendedText = false,
}) {
  final rules = platformRules[platform.toLowerCase()];
  if (rules == null) return [];

  final issues = <ValidationIssue>[];
  final totalMedia = imageCount + videoCount;

  final limit = isExtendedText && rules.maxTextLengthExtended != null
      ? rules.maxTextLengthExtended!
      : rules.maxTextLength;

  if (text.characters.length > limit) {
    issues.add(ValidationIssue(
      platform: platform,
      severity: 'error',
      code: 'TEXT_TOO_LONG',
      message: '${rules.label} allows $limit characters (currently ${text.characters.length}).',
    ));
  }

  if (totalMedia == 0) {
    if (rules.requiresVideo) {
      issues.add(ValidationIssue(
        platform: platform,
        severity: 'error',
        code: 'VIDEO_REQUIRED',
        message: '${rules.label} requires a video.',
      ));
    } else if (!rules.allowsTextOnly) {
      issues.add(ValidationIssue(
        platform: platform,
        severity: 'error',
        code: 'MEDIA_REQUIRED',
        message: '${rules.label} requires an image or video.',
      ));
    } else if (text.trim().isEmpty) {
      issues.add(ValidationIssue(
        platform: platform,
        severity: 'error',
        code: 'EMPTY_POST',
        message: 'Write something or attach media.',
      ));
    }
  } else if (rules.requiresVideo && videoCount == 0) {
    issues.add(ValidationIssue(
      platform: platform,
      severity: 'error',
      code: 'VIDEO_REQUIRED',
      message: '${rules.label} requires a video.',
    ));
  }

  if (imageCount > rules.maxImages) {
    issues.add(ValidationIssue(
      platform: platform,
      severity: 'error',
      code: 'TOO_MANY_IMAGES',
      message: rules.maxImages == 0
          ? '${rules.label} does not accept images.'
          : '${rules.label} allows at most ${rules.maxImages} images.',
    ));
  }

  if (videoCount > rules.maxVideos) {
    issues.add(ValidationIssue(
      platform: platform,
      severity: 'error',
      code: 'TOO_MANY_VIDEOS',
      message: '${rules.label} allows at most ${rules.maxVideos} video(s).',
    ));
  }

  if (!rules.allowsMixedMedia && imageCount > 0 && videoCount > 0) {
    issues.add(ValidationIssue(
      platform: platform,
      severity: 'error',
      code: 'MIXED_MEDIA',
      message: '${rules.label} does not allow mixing images and videos.',
    ));
  }

  final urlRe = RegExp(r'\bhttps?://\S+|\bwww\.\S+', caseSensitive: false);
  if (rules.linksNotClickable && urlRe.hasMatch(text)) {
    issues.add(ValidationIssue(
      platform: platform,
      severity: 'warning',
      code: 'LINKS_NOT_CLICKABLE',
      message: 'Links are not clickable on ${rules.label}; they show as plain text.',
    ));
  }

  return issues;
}
