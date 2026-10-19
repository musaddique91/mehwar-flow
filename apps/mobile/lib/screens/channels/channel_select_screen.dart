import 'package:flutter/material.dart';
import '../../models/channel_model.dart';
import '../../services/channels_service.dart';

class ChannelSelectScreen extends StatefulWidget {
  final String sessionToken;
  const ChannelSelectScreen({super.key, required this.sessionToken});

  @override
  State<ChannelSelectScreen> createState() => _ChannelSelectScreenState();
}

class _ChannelSelectScreenState extends State<ChannelSelectScreen> {
  final ChannelsService _service = ChannelsService();
  List<PendingAccount> _accounts = [];
  final Set<String> _selectedIds = {};
  bool _loading = false;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPending();
  }

  Future<void> _loadPending() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await _service.getPendingAccounts(widget.sessionToken);
      setState(() {
        _accounts = list;
        // Pre-select all by default
        _selectedIds.addAll(list.map((a) => a.id));
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _submitSelection() async {
    if (_selectedIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select at least one account.')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await _service.completePendingAccounts(widget.sessionToken, _selectedIds.toList());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Channels connected successfully!')),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to connect: $e')),
        );
      }
    } finally {
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Select Accounts to Connect'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('Error: $_error'))
              : _accounts.isEmpty
                  ? const Center(child: Text('No accounts found for this session.'))
                  : Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Text(
                            'We found multiple accounts or pages. Select the ones you want to connect to Mehwar Flow:',
                            style: TextStyle(color: Colors.grey.shade600),
                          ),
                        ),
                        Expanded(
                          child: ListView.separated(
                            itemCount: _accounts.length,
                            separatorBuilder: (_, __) => const Divider(height: 1),
                            itemBuilder: (context, index) {
                              final acc = _accounts[index];
                              final isSelected = _selectedIds.contains(acc.id);
                              return CheckboxListTile(
                                value: isSelected,
                                onChanged: (val) {
                                  setState(() {
                                    if (val == true) {
                                      _selectedIds.add(acc.id);
                                    } else {
                                      _selectedIds.remove(acc.id);
                                    }
                                  });
                                },
                                secondary: CircleAvatar(
                                  backgroundImage: acc.picture != null ? NetworkImage(acc.picture!) : null,
                                  child: acc.picture == null ? Text(acc.name.isNotEmpty ? acc.name[0] : '?') : null,
                                ),
                                title: Text(acc.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                                subtitle: acc.category != null ? Text(acc.category!) : null,
                              );
                            },
                          ),
                        ),
                        SafeArea(
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: ElevatedButton(
                                onPressed: _submitting ? null : _submitSelection,
                                child: _submitting
                                    ? const CircularProgressIndicator(color: Colors.white)
                                    : Text('Connect Selected (${_selectedIds.length})'),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
    );
  }
}
