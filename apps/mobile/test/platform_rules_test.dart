import 'package:flutter_test/flutter_test.dart';
import 'package:mehwar_mobile/core/validation/platform_rules.dart';

void main() {
  group('PlatformRules Validation', () {
    test('X allows up to 280 characters by default, and 25000 if extended', () {
      final normalText = 'a' * 280;
      final normalIssues = validatePostForPlatform(
        platform: 'x',
        text: normalText,
        imageCount: 0,
        videoCount: 0,
      );
      expect(normalIssues.any((i) => i.code == 'TEXT_TOO_LONG'), isFalse);

      final overText = 'a' * 281;
      final overIssues = validatePostForPlatform(
        platform: 'x',
        text: overText,
        imageCount: 0,
        videoCount: 0,
        isExtendedText: false,
      );
      expect(overIssues.any((i) => i.code == 'TEXT_TOO_LONG'), isTrue);

      final extendedAllowed = validatePostForPlatform(
        platform: 'x',
        text: overText,
        imageCount: 0,
        videoCount: 0,
        isExtendedText: true,
      );
      expect(extendedAllowed.any((i) => i.code == 'TEXT_TOO_LONG'), isFalse);
    });

    test('YouTube requires a video', () {
      final noVideo = validatePostForPlatform(
        platform: 'youtube',
        text: 'Hello world',
        imageCount: 0,
        videoCount: 0,
      );
      expect(noVideo.any((i) => i.code == 'VIDEO_REQUIRED'), isTrue);

      final withVideo = validatePostForPlatform(
        platform: 'youtube',
        text: 'Hello world',
        imageCount: 0,
        videoCount: 1,
      );
      expect(withVideo.any((i) => i.code == 'VIDEO_REQUIRED'), isFalse);
    });

    test('Instagram does not allow text-only posts', () {
      final textOnly = validatePostForPlatform(
        platform: 'instagram',
        text: 'Just text here',
        imageCount: 0,
        videoCount: 0,
      );
      expect(textOnly.any((i) => i.code == 'MEDIA_REQUIRED'), isTrue);

      final withImage = validatePostForPlatform(
        platform: 'instagram',
        text: 'With image',
        imageCount: 1,
        videoCount: 0,
      );
      expect(withImage.any((i) => i.code == 'MEDIA_REQUIRED'), isFalse);
    });

    test('TikTok warns about non-clickable links and video requirement', () {
      final issues = validatePostForPlatform(
        platform: 'tiktok',
        text: 'Visit https://mehwar.flow now',
        imageCount: 0,
        videoCount: 1,
      );
      expect(issues.any((i) => i.code == 'LINKS_NOT_CLICKABLE'), isTrue);
    });

    test('WhatsApp allows up to 4096 characters', () {
      final okText = 'a' * 4096;
      final okIssues = validatePostForPlatform(
        platform: 'whatsapp',
        text: okText,
        imageCount: 0,
        videoCount: 0,
      );
      expect(okIssues.any((i) => i.code == 'TEXT_TOO_LONG'), isFalse);

      final longText = 'a' * 4097;
      final longIssues = validatePostForPlatform(
        platform: 'whatsapp',
        text: longText,
        imageCount: 0,
        videoCount: 0,
      );
      expect(longIssues.any((i) => i.code == 'TEXT_TOO_LONG'), isTrue);
    });
  });
}
