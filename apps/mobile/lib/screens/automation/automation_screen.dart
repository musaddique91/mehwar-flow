import 'package:flutter/material.dart';
import '../../models/automation_model.dart';
import '../../services/automation_service.dart';

class AutomationScreen extends StatefulWidget {
  const AutomationScreen({super.key});

  @override
  State<AutomationScreen> createState() => _AutomationScreenState();
}

class _AutomationScreenState extends State<AutomationScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final AutomationService _service = AutomationService();

  AutomationOverviewDto? _overview;
  List<SchedulerConfigDto> _schedulers = [];
  List<SchedulerRunDto> _runs = [];
  List<OrderInquiryDto> _leads = [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final overview = await _service.getOverview();
      final schedulers = await _service.listSchedulers();
      final runs = await _service.listRuns();
      final leads = await _service.listLeads();
      setState(() {
        _overview = overview;
        _schedulers = schedulers;
        _runs = runs;
        _leads = leads;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _toggleScheduler(SchedulerConfigDto scheduler, bool val) async {
    try {
      final updated = await _service.toggleScheduler(scheduler.id, val);
      setState(() {
        final idx = _schedulers.indexWhere((s) => s.id == scheduler.id);
        if (idx != -1) _schedulers[idx] = updated;
      });
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _triggerRun(SchedulerConfigDto scheduler) async {
    try {
      await _service.triggerRun(scheduler.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Triggered "${scheduler.name}" run')));
      }
      _loadData();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _updateLeadStatus(OrderInquiryDto lead, String newStatus) async {
    try {
      final updated = await _service.updateLeadStatus(lead.id, newStatus);
      setState(() {
        final idx = _leads.indexWhere((l) => l.id == lead.id);
        if (idx != -1) _leads[idx] = updated;
      });
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Automation & Leads'),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(text: 'Schedulers (${_schedulers.length})'),
            Tab(text: 'Runs (${_runs.length})'),
            Tab(text: 'Leads (${_leads.length})'),
          ],
        ),
      ),
      body: _loading && _overview == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _overview == null
              ? Center(child: Text('Error: $_error'))
              : Column(
                  children: [
                    if (_overview != null) _buildOverviewCards(),
                    Expanded(
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          _buildSchedulersTab(),
                          _buildRunsTab(),
                          _buildLeadsTab(),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildOverviewCards() {
    final ov = _overview!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest.withAlpha(70),
        border: Border(bottom: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _statItem('Active Schedulers', '${ov.activeSchedulers}/${ov.totalSchedulers}'),
          _statItem('Runs Today', '${ov.runsToday}'),
          _statItem('Pending Leads', '${ov.pendingInquiries}', isWarning: ov.pendingInquiries > 0),
        ],
      ),
    );
  }

  Widget _statItem(String label, String value, {bool isWarning = false}) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: isWarning ? Colors.orange : null,
          ),
        ),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
      ],
    );
  }

  Widget _buildSchedulersTab() {
    if (_schedulers.isEmpty) {
      return const Center(child: Text('No schedulers configured.'));
    }
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _schedulers.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final s = _schedulers[index];
          return Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          s.name,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                      ),
                      Switch(
                        value: s.enabled,
                        onChanged: (val) => _toggleScheduler(s, val),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.blue.withAlpha(30),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          s.cronExpression,
                          style: const TextStyle(fontSize: 11, fontFamily: 'monospace', color: Colors.blue),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Target: ${s.platform.isNotEmpty ? s.platform : 'All'}',
                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        s.lastRunAt != null ? 'Last run: ${_formatDate(s.lastRunAt!)}' : 'Never run',
                        style: const TextStyle(fontSize: 11, color: Colors.grey),
                      ),
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
                        onPressed: () => _triggerRun(s),
                        icon: const Icon(Icons.play_arrow, size: 16),
                        label: const Text('Run Now'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildRunsTab() {
    if (_runs.isEmpty) {
      return const Center(child: Text('No scheduler runs recorded.'));
    }
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _runs.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final r = _runs[index];
          final isSuccess = r.status.toLowerCase() == 'success' || r.status.toLowerCase() == 'completed';
          final isFailed = r.status.toLowerCase() == 'failed' || r.status.toLowerCase() == 'error';

          return Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: ListTile(
              leading: Icon(
                isSuccess
                    ? Icons.check_circle
                    : isFailed
                        ? Icons.error
                        : Icons.hourglass_top,
                color: isSuccess
                    ? Colors.green
                    : isFailed
                        ? Colors.red
                        : Colors.orange,
              ),
              title: Text(r.schedulerName, style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Started: ${_formatDate(r.startedAt)} • Status: ${r.status}'),
                  if (r.durationSec != null) Text('Duration: ${r.durationSec}s'),
                  if (r.errorMessage != null)
                    Text('Error: ${r.errorMessage}', style: const TextStyle(color: Colors.red, fontSize: 12)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildLeadsTab() {
    if (_leads.isEmpty) {
      return const Center(child: Text('No order inquiries / leads found.'));
    }
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _leads.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final lead = _leads[index];
          return Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        lead.customerName.isNotEmpty ? lead.customerName : 'Unknown Lead',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      DropdownButton<String>(
                        value: lead.status,
                        underline: const SizedBox(),
                        items: ['pending', 'contacted', 'closed', 'cancelled'].map((st) {
                          return DropdownMenuItem(
                            value: st,
                            child: Text(st.toUpperCase(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                          );
                        }).toList(),
                        onChanged: (newSt) {
                          if (newSt != null && newSt != lead.status) {
                            _updateLeadStatus(lead, newSt);
                          }
                        },
                      ),
                    ],
                  ),
                  if (lead.customerPhone != null || lead.customerEmail != null)
                    Text(
                      '${lead.customerPhone ?? ''} ${lead.customerEmail ?? ''}'.trim(),
                      style: const TextStyle(fontSize: 12, color: Colors.blueGrey),
                    ),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surfaceContainerHighest.withAlpha(50),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(lead.message, style: const TextStyle(fontSize: 13)),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Received: ${_formatDate(lead.createdAt)}',
                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  String _formatDate(dynamic val) {
    if (val == null) return '';
    final dt = val is DateTime ? val : DateTime.tryParse(val.toString())?.toLocal();
    if (dt == null) return val.toString();
    return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}
