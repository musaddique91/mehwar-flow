import 'package:flutter/material.dart';
import '../models/channel_model.dart';
import '../services/channels_service.dart';

class ChannelsProvider extends ChangeNotifier {
  final ChannelsService _channelsService = ChannelsService();

  List<ChannelDto> _channels = [];
  List<String> _availablePlatforms = [];
  bool _isLoading = false;
  String? _errorMessage;
  String? _selectedFilter;

  List<ChannelDto> get channels {
    if (_selectedFilter == null || _selectedFilter!.isEmpty || _selectedFilter == 'ALL') {
      return _channels;
    }
    return _channels.where((c) => c.platform.toLowerCase() == _selectedFilter!.toLowerCase()).toList();
  }

  List<ChannelDto> get allChannels => _channels;
  List<String> get availablePlatforms => _availablePlatforms;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String? get selectedFilter => _selectedFilter;

  void setFilter(String? filter) {
    _selectedFilter = filter;
    notifyListeners();
  }

  Future<void> fetchChannels() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _channelsService.getChannels(),
        _channelsService.getAvailablePlatforms(),
      ]);
      _channels = results[0] as List<ChannelDto>;
      _availablePlatforms = results[1] as List<String>;
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> deleteChannel(String id) async {
    try {
      await _channelsService.removeChannel(id);
      _channels.removeWhere((c) => c.id == id);
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Returns the OAuth URL to open in browser for a given platform.
  Future<String?> getAuthUrl(String platform) async {
    return _channelsService.getAuthUrl(platform);
  }
}

