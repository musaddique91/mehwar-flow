import 'package:flutter/material.dart';
import '../models/analytics_model.dart';
import '../services/analytics_service.dart';

class AnalyticsProvider extends ChangeNotifier {
  final AnalyticsService _analyticsService = AnalyticsService();

  AnalyticsSummaryDto? _summary;
  bool _isLoading = false;
  String? _errorMessage;
  int _selectedDays = 30;

  AnalyticsSummaryDto? get summary => _summary;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  int get selectedDays => _selectedDays;

  Future<void> fetchAnalytics({int? days}) async {
    if (days != null) _selectedDays = days;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _summary = await _analyticsService.getSummary(days: _selectedDays);
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> syncAnalytics() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _summary = await _analyticsService.syncAnalytics(days: _selectedDays);
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void setDays(int days) {
    if (_selectedDays != days) {
      _selectedDays = days;
      fetchAnalytics(days: days);
    }
  }
}
