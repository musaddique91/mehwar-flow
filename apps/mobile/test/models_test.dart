import 'package:flutter_test/flutter_test.dart';
import 'package:mehwar_mobile/models/channel_model.dart';
import 'package:mehwar_mobile/models/media_model.dart';
import 'package:mehwar_mobile/models/customer_model.dart';
import 'package:mehwar_mobile/models/automation_model.dart';
import 'package:mehwar_mobile/models/post_model.dart';

void main() {
  group('Mobile Models Serialization & Compatibility', () {
    test('ChannelDto and ChannelDetailDto parse correctly with compatibility getters', () {
      final channel = ChannelDto.fromJson({
        'id': 'chan-1',
        'platform': 'youtube',
        'displayName': 'Tech Channel',
        'avatarUrl': 'https://example.com/avatar.png',
        'status': 'ACTIVE',
      });

      expect(channel.id, 'chan-1');
      expect(channel.name, 'Tech Channel');
      expect(channel.picture, 'https://example.com/avatar.png');
      expect(channel.isActive, isTrue);

      final detail = ChannelDetailDto.fromJson({
        'id': 'chan-1',
        'platform': 'youtube',
        'displayName': 'Tech Channel',
        'channelId': 'ext-123',
        'title': 'Tech Channel Official',
        'subscriberCount': 10500,
        'videoCount': 42,
        'videos': [
          {'id': 'v-1', 'title': 'First Video'}
        ],
      });

      expect(detail.followersCount, 10500);
      expect(detail.postCount, 42);
      expect(detail.recentPosts.length, 1);
      expect(detail.channel.displayName, 'Tech Channel');
    });

    test('MediaDto parses kind and exposes displayUrl', () {
      final media = MediaDto.fromJson({
        'id': 'med-1',
        'filename': 'video.mp4',
        'kind': 'video',
        'url': 'https://example.com/video.mp4',
        'durationSec': 120,
      });

      expect(media.isVideo, isTrue);
      expect(media.isImage, isFalse);
      expect(media.filename, 'video.mp4');
      expect(media.displayUrl, 'https://example.com/video.mp4');
    });

    test('CustomerDto parses and phone fallback works', () {
      final customer = CustomerDto.fromJson({
        'id': 'cust-1',
        'name': 'Ali Khan',
        'mobileNumber': '+971501234567',
        'whatsappNumber': '+971501234567',
      });

      expect(customer.name, 'Ali Khan');
      expect(customer.phone, '+971501234567');
    });

    test('Automation models expose compatibility getters', () {
      final scheduler = SchedulerConfigDto.fromJson({
        'id': 'sched-1',
        'type': 'CONTENT_CURATOR',
        'name': 'Daily Auto Curator',
        'enabled': true,
        'intervalMinutes': 120,
      });

      expect(scheduler.cronExpression, 'Every 120 min');
      expect(scheduler.platform, 'ALL');

      final inquiry = OrderInquiryDto.fromJson({
        'id': 'inq-1',
        'platform': 'instagram',
        'authorName': 'Fatima',
        'commentText': 'How much is this item?',
        'priority': 'HIGH',
        'intentCategory': 'ORDER_INQUIRY',
        'status': 'NEW',
        'detectedAt': '2026-10-18T00:00:00Z',
      });

      expect(inquiry.customerName, 'Fatima');
      expect(inquiry.message, 'How much is this item?');
    });

    test('TargetInput serializes to JSON matching backend targetInputSchema', () {
      final target = TargetInput(
        channelId: 'chan-youtube',
        options: TargetOptions(
          title: 'Mobile Video Upload',
          privacy: 'public',
          igMediaType: 'reels',
          disableComment: true,
        ),
      );

      final json = target.toJson();
      expect(json['channelId'], 'chan-youtube');
      expect(json['options']['title'], 'Mobile Video Upload');
      expect(json['options']['privacy'], 'public');
      expect(json['options']['igMediaType'], 'reels');
      expect(json['options']['disableComment'], isTrue);
    });
  });
}
