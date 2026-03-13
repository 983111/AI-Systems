// lib/screens/BudgetScreen.dart

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/BudgetService.dart';
import '../widgets/AddTransactionSheet.dart';

class BudgetScreen extends StatefulWidget {
  const BudgetScreen({super.key});

  @override
  State<BudgetScreen> createState() => _BudgetScreenState();
}

class _BudgetScreenState extends State<BudgetScreen> with SingleTickerProviderStateMixin {
  final BudgetService _budgetService = BudgetService();
  late TabController _tabController;

  Map<BudgetFilter, Map<String, double>> _summaries = {};
  Map<BudgetFilter, List<Map<String, dynamic>>> _transactions = {};
  Map<BudgetFilter, bool> _isLoading = {
    BudgetFilter.daily: true,
    BudgetFilter.monthly: true,
    BudgetFilter.yearly: true,
  };

  // For custom date selection
  DateTime? _selectedDate;
  int? _selectedMonth;
  int? _selectedYear;

  BudgetFilter get _currentFilter => BudgetFilter.values[_tabController.index];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this, initialIndex: 1);
    _selectedDate = DateTime.now();
    _selectedMonth = DateTime.now().month;
    _selectedYear = DateTime.now().year;
    _fetchAllData();
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchAllData() async {
    for (var filter in BudgetFilter.values) {
      _fetchDataForFilter(filter);
    }
  }

  Future<void> _fetchDataForFilter(BudgetFilter filter) async {
    if (!mounted) return;
    setState(() => _isLoading[filter] = true);

    try {
      Map<String, double> summary;
      List<Map<String, dynamic>> transactions;

      switch (filter) {
        case BudgetFilter.daily:
          summary = await _budgetService.getSummaryForDate(_selectedDate!);
          transactions = await _budgetService.getTransactionsForDate(_selectedDate!);
          break;
        case BudgetFilter.monthly:
          summary = await _budgetService.getSummaryForMonth(_selectedYear!, _selectedMonth!);
          transactions = await _budgetService.getTransactionsForMonth(_selectedYear!, _selectedMonth!);
          break;
        case BudgetFilter.yearly:
          summary = await _budgetService.getSummaryForYear(_selectedYear!);
          transactions = await _budgetService.getTransactionsForYear(_selectedYear!);
          break;
      }

      if (mounted) {
        setState(() {
          _summaries[filter] = summary;
          _transactions[filter] = transactions;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error fetching data: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading[filter] = false);
      }
    }
  }

  void _showAddTransactionSheet(String type) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => AddTransactionSheet(type: type, budgetService: _budgetService),
    ).then((result) {
      if (result == true) {
        _fetchAllData();
      }
    });
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() => _selectedDate = picked);
      _fetchDataForFilter(BudgetFilter.daily);
    }
  }

  Future<void> _selectMonth() async {
    final picked = await showDialog<DateTime>(
      context: context,
      builder: (context) => _MonthYearPickerDialog(
        initialMonth: _selectedMonth!,
        initialYear: _selectedYear!,
      ),
    );
    if (picked != null) {
      setState(() {
        _selectedMonth = picked.month;
        _selectedYear = picked.year;
      });
      _fetchDataForFilter(BudgetFilter.monthly);
    }
  }

  Future<void> _selectYear() async {
    final picked = await showDialog<int>(
      context: context,
      builder: (context) => _YearPickerDialog(initialYear: _selectedYear!),
    );
    if (picked != null) {
      setState(() => _selectedYear = picked);
      _fetchDataForFilter(BudgetFilter.yearly);
    }
  }

  void _showEditTransactionSheet(Map<String, dynamic> transaction) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => AddTransactionSheet(
        type: transaction['type'],
        budgetService: _budgetService,
        existingTransaction: transaction,
      ),
    ).then((result) {
      if (result == true) {
        _fetchAllData();
      }
    });
  }

  String _getDateRangeText() {
    switch (_currentFilter) {
      case BudgetFilter.daily:
        return DateFormat('d MMM, yyyy').format(_selectedDate!);
      case BudgetFilter.monthly:
        return DateFormat('MMMM yyyy').format(DateTime(_selectedYear!, _selectedMonth!));
      case BudgetFilter.yearly:
        return _selectedYear.toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final currentSummary = _summaries[_currentFilter] ?? {'income': 0.0, 'expense': 0.0};
    final income = currentSummary['income'] ?? 0;
    final expense = currentSummary['expense'] ?? 0;
    final balance = income - expense;
    final savings = balance;
    final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Scaffold(
      body: Column(
        children: [
          // App Bar
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'My Budget',
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  IconButton(
                    onPressed: _fetchAllData,
                    icon: const Icon(Icons.refresh_rounded),
                    style: IconButton.styleFrom(
                      backgroundColor: colorScheme.primaryContainer,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Tab Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Container(
              decoration: BoxDecoration(
                color: colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(16),
              ),
              child: TabBar(
                controller: _tabController,
                indicator: BoxDecoration(
                  color: colorScheme.primary,
                  borderRadius: BorderRadius.circular(12),
                ),
                labelColor: colorScheme.onPrimary,
                unselectedLabelColor: colorScheme.onSurfaceVariant,
                indicatorSize: TabBarIndicatorSize.tab,
                dividerColor: Colors.transparent,
                padding: const EdgeInsets.all(4),
                tabs: const [
                  Tab(text: 'Daily'),
                  Tab(text: 'Monthly'),
                  Tab(text: 'Yearly'),
                ],
              ),
            ),
          ),

          // Date Selector
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: InkWell(
              onTap: () {
                switch (_currentFilter) {
                  case BudgetFilter.daily:
                    _selectDate();
                    break;
                  case BudgetFilter.monthly:
                    _selectMonth();
                    break;
                  case BudgetFilter.yearly:
                    _selectYear();
                    break;
                }
              },
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: colorScheme.secondaryContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.calendar_today, size: 20, color: colorScheme.onSecondaryContainer),
                    const SizedBox(width: 8),
                    Text(
                      _getDateRangeText(),
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                        color: colorScheme.onSecondaryContainer,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(Icons.arrow_drop_down, color: colorScheme.onSecondaryContainer),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Summary Card
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _buildSummaryCard(balance, savings, income, expense, currencyFormat, colorScheme),
          ),

          // Action Buttons
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Expanded(
                  child: _buildActionButton(
                    label: 'Income',
                    icon: Icons.arrow_upward_rounded,
                    color: Colors.green,
                    onTap: () => _showAddTransactionSheet('income'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildActionButton(
                    label: 'Expense',
                    icon: Icons.arrow_downward_rounded,
                    color: Colors.red,
                    onTap: () => _showAddTransactionSheet('expense'),
                  ),
                ),
              ],
            ),
          ),

          // Transactions List
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: BudgetFilter.values.map((filter) {
                final isLoading = _isLoading[filter] ?? true;
                final transactions = _transactions[filter] ?? [];

                if (isLoading) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (transactions.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.receipt_long_outlined, size: 64, color: colorScheme.outline),
                        const SizedBox(height: 16),
                        Text(
                          'No transactions yet',
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  );
                }

                return ListView.builder(
                  key: ValueKey(filter),
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  itemCount: transactions.length,
                  itemBuilder: (context, index) {
                    return _buildTransactionTile(
                      transactions[index],
                      currencyFormat,
                      colorScheme,
                    );
                  },
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(double balance, double savings, double income, double expense, NumberFormat currencyFormat, ColorScheme colorScheme) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colorScheme.primaryContainer,
            colorScheme.secondaryContainer,
          ],
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: colorScheme.primary.withOpacity(0.1),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: _buildSummaryItem(
                  Icons.account_balance_wallet_rounded,
                  'Balance',
                  currencyFormat.format(balance),
                  balance >= 0 ? Colors.green.shade700 : Colors.red.shade700,
                ),
              ),
              Container(
                width: 1,
                height: 50,
                color: colorScheme.outline.withOpacity(0.3),
              ),
              Expanded(
                child: _buildSummaryItem(
                  Icons.savings_rounded,
                  'Savings',
                  currencyFormat.format(savings),
                  Colors.blue.shade700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Divider(),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildSummaryDetail(
                  Icons.arrow_upward_rounded,
                  'Income',
                  income,
                  Colors.green,
                  currencyFormat,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildSummaryDetail(
                  Icons.arrow_downward_rounded,
                  'Expense',
                  expense,
                  Colors.red,
                  currencyFormat,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryItem(IconData icon, String label, String value, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 28),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            color: Colors.grey.shade700,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: color,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildSummaryDetail(IconData icon, String label, double value, Color color, NumberFormat format) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 16),
              const SizedBox(width: 4),
              Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            format.format(value),
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: color),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({required String label, required IconData icon, required Color color, required VoidCallback onTap}) {
    return ElevatedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 20),
      label: Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        elevation: 2,
      ),
    );
  }

  Widget _buildTransactionTile(Map<String, dynamic> transaction, NumberFormat format, ColorScheme colorScheme) {
    final bool isIncome = transaction['type'] == 'income';
    final amount = (transaction['amount'] as num).toDouble();
    final date = DateTime.parse(transaction['date']);
    final description = transaction['description'] as String?;

    return Card(
      elevation: 0,
      color: colorScheme.surfaceContainer,
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: () => _showEditTransactionSheet(transaction),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: (isIncome ? Colors.green : Colors.red).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  isIncome ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
                  color: isIncome ? Colors.green.shade600 : Colors.red.shade600,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      transaction['category'] ?? 'N/A',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      DateFormat('d MMM, yyyy • hh:mm a').format(date),
                      style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 12),
                    ),
                    if (description != null && description.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          description,
                          style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 12),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${isIncome ? '+' : '-'} ${format.format(amount)}',
                    style: TextStyle(
                      color: isIncome ? Colors.green.shade600 : Colors.red.shade600,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Month Year Picker Dialog
class _MonthYearPickerDialog extends StatefulWidget {
  final int initialMonth;
  final int initialYear;

  const _MonthYearPickerDialog({
    required this.initialMonth,
    required this.initialYear,
  });

  @override
  State<_MonthYearPickerDialog> createState() => _MonthYearPickerDialogState();
}

class _MonthYearPickerDialogState extends State<_MonthYearPickerDialog> {
  late int selectedMonth;
  late int selectedYear;

  @override
  void initState() {
    super.initState();
    selectedMonth = widget.initialMonth;
    selectedYear = widget.initialYear;
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final years = List.generate(10, (i) => DateTime.now().year - i);

    return AlertDialog(
      title: const Text('Select Month & Year'),
      content: SizedBox(
        width: 300,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<int>(
              value: selectedYear,
              decoration: const InputDecoration(labelText: 'Year'),
              items: years.map((y) => DropdownMenuItem(value: y, child: Text(y.toString()))).toList(),
              onChanged: (value) => setState(() => selectedYear = value!),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: List.generate(12, (i) {
                final month = i + 1;
                final isSelected = month == selectedMonth;
                return InkWell(
                  onTap: () => setState(() => selectedMonth = month),
                  child: Container(
                    width: 60,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: isSelected ? colorScheme.primary : colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      months[i],
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: isSelected ? colorScheme.onPrimary : colorScheme.onSurface,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ),
                );
              }),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, DateTime(selectedYear, selectedMonth)),
          child: const Text('OK'),
        ),
      ],
    );
  }
}

// Year Picker Dialog
class _YearPickerDialog extends StatelessWidget {
  final int initialYear;

  const _YearPickerDialog({required this.initialYear});

  @override
  Widget build(BuildContext context) {
    final years = List.generate(20, (i) => DateTime.now().year - i);

    return AlertDialog(
      title: const Text('Select Year'),
      content: SizedBox(
        width: 300,
        height: 400,
        child: ListView.builder(
          itemCount: years.length,
          itemBuilder: (context, index) {
            final year = years[index];
            return ListTile(
              title: Text(year.toString()),
              selected: year == initialYear,
              onTap: () => Navigator.pop(context, year),
            );
          },
        ),
      ),
    );
  }
}