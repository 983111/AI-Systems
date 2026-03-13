// lib/widgets/AddTransactionSheet.dart

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../services/BudgetService.dart';

class AddTransactionSheet extends StatefulWidget {
  final String type; // 'income' or 'expense'
  final BudgetService budgetService;
  final Map<String, dynamic>? existingTransaction;

  const AddTransactionSheet({
    super.key,
    required this.type,
    required this.budgetService,
    this.existingTransaction,
  });

  @override
  State<AddTransactionSheet> createState() => _AddTransactionSheetState();
}

class _AddTransactionSheetState extends State<AddTransactionSheet> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _otherCategoryController = TextEditingController();

  List<String> _categories = [];
  String? _selectedCategory;
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _selectedTime = TimeOfDay.now();
  bool _isLoadingCategories = true;
  bool _isSaving = false;
  bool _showOtherCategoryField = false;
  bool _isEditMode = false;

  @override
  void initState() {
    super.initState();
    _isEditMode = widget.existingTransaction != null;

    if (_isEditMode) {
      _loadExistingTransaction();
    }

    _loadCategories();
  }

  void _loadExistingTransaction() {
    final transaction = widget.existingTransaction!;
    _amountController.text = transaction['amount'].toString();
    _descriptionController.text = transaction['description'] ?? '';
    _selectedCategory = transaction['category'];

    final date = DateTime.parse(transaction['date']);
    _selectedDate = date;
    _selectedTime = TimeOfDay.fromDateTime(date);
  }

  Future<void> _loadCategories() async {
    try {
      final categories = await widget.budgetService.getCategories(widget.type);
      if (mounted) {
        setState(() {
          _categories = categories;
          _isLoadingCategories = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingCategories = false);
      }
    }
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );

    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _selectTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime,
    );

    if (picked != null) {
      setState(() => _selectedTime = picked);
    }
  }

  Future<void> _onSave() async {
    if (!_formKey.currentState!.validate()) return;
    if (_isSaving) return;

    setState(() => _isSaving = true);

    try {
      String finalCategory = _selectedCategory!;

      // If 'Other' was selected and a new category was entered
      if (_showOtherCategoryField && _otherCategoryController.text.isNotEmpty) {
        final newCategory = _otherCategoryController.text.trim();
        await widget.budgetService.addCategory(name: newCategory, type: widget.type);
        finalCategory = newCategory;
      }

      // Combine date and time
      final finalDateTime = DateTime(
        _selectedDate.year,
        _selectedDate.month,
        _selectedDate.day,
        _selectedTime.hour,
        _selectedTime.minute,
      );

      if (_isEditMode) {
        // Update existing transaction
        await widget.budgetService.updateTransaction(
          transactionId: widget.existingTransaction!['id'].toString(),
          amount: double.parse(_amountController.text),
          type: widget.type,
          category: finalCategory,
          description: _descriptionController.text.trim(),
          date: finalDateTime,
        );
      } else {
        // Add new transaction
        await widget.budgetService.addTransaction(
          amount: double.parse(_amountController.text),
          type: widget.type,
          category: finalCategory,
          description: _descriptionController.text.trim(),
          date: finalDateTime,
        );
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(Icons.check_circle, color: Colors.white),
                const SizedBox(width: 12),
                Text(_isEditMode ? 'Transaction updated!' : 'Transaction saved!'),
              ],
            ),
            backgroundColor: Colors.green.shade600,
            behavior: SnackBarBehavior.floating,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.error, color: Colors.white),
                const SizedBox(width: 12),
                Expanded(child: Text('Failed: ${e.toString()}')),
              ],
            ),
            backgroundColor: Colors.red.shade600,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _onDelete() async {
    if (!_isEditMode) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Transaction'),
        content: const Text('Are you sure you want to delete this transaction?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await widget.budgetService.deleteTransaction(
        widget.existingTransaction!['id'].toString(),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.check_circle, color: Colors.white),
                SizedBox(width: 12),
                Text('Transaction deleted!'),
              ],
            ),
            backgroundColor: Colors.orange.shade700,
            behavior: SnackBarBehavior.floating,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isIncome = widget.type == 'income';

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SingleChildScrollView(
        child: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom + 24,
            top: 24,
            left: 24,
            right: 24,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _isEditMode
                          ? 'Edit ${isIncome ? 'Income' : 'Expense'}'
                          : 'Add ${isIncome ? 'Income' : 'Expense'}',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    if (_isEditMode)
                      IconButton(
                        onPressed: _onDelete,
                        icon: const Icon(Icons.delete_outline),
                        color: Colors.red,
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.red.withOpacity(0.1),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 24),

                // Amount Field
                TextFormField(
                  controller: _amountController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
                  ],
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                  decoration: InputDecoration(
                    labelText: 'Amount',
                    prefixIcon: Icon(
                      Icons.currency_rupee,
                      color: isIncome ? Colors.green : Colors.red,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    filled: true,
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Enter amount';
                    final amount = double.tryParse(v);
                    if (amount == null || amount <= 0) return 'Enter valid amount';
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Category Field
                if (_isLoadingCategories)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator(),
                    ),
                  )
                else
                  DropdownButtonFormField<String>(
                    value: _selectedCategory,
                    hint: const Text('Select Category'),
                    decoration: InputDecoration(
                      labelText: 'Category',
                      prefixIcon: const Icon(Icons.category_outlined),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      filled: true,
                    ),
                    items: _categories
                        .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                        .toList(),
                    onChanged: (value) {
                      setState(() {
                        _selectedCategory = value;
                        _showOtherCategoryField = value == 'Other';
                      });
                    },
                    validator: (v) => v == null ? 'Select category' : null,
                  ),

                // Other Category Field
                if (_showOtherCategoryField) ...[
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _otherCategoryController,
                    decoration: InputDecoration(
                      labelText: 'New Category Name',
                      prefixIcon: const Icon(Icons.add_circle_outline),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      filled: true,
                    ),
                    validator: (v) => (_showOtherCategoryField && (v == null || v.isEmpty))
                        ? 'Enter category name'
                        : null,
                  ),
                ],
                const SizedBox(height: 16),

                // Date and Time Selectors
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: _selectDate,
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: colorScheme.outline.withOpacity(0.3)),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.calendar_today, color: colorScheme.primary),
                              const SizedBox(width: 12),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Date',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: colorScheme.onSurfaceVariant,
                                    ),
                                  ),
                                  Text(
                                    DateFormat('d MMM, yyyy').format(_selectedDate),
                                    style: const TextStyle(fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: InkWell(
                        onTap: _selectTime,
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: colorScheme.outline.withOpacity(0.3)),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.access_time, color: colorScheme.primary),
                              const SizedBox(width: 12),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Time',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: colorScheme.onSurfaceVariant,
                                    ),
                                  ),
                                  Text(
                                    _selectedTime.format(context),
                                    style: const TextStyle(fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Description Field
                TextFormField(
                  controller: _descriptionController,
                  maxLines: 3,
                  decoration: InputDecoration(
                    labelText: 'Description (Optional)',
                    prefixIcon: const Icon(Icons.description_outlined),
                    alignLabelWithHint: true,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    filled: true,
                  ),
                ),
                const SizedBox(height: 24),

                // Save Button
                FilledButton.icon(
                  onPressed: _isSaving ? null : _onSave,
                  icon: _isSaving
                      ? const SizedBox.shrink()
                      : Icon(_isEditMode ? Icons.check : Icons.save),
                  label: _isSaving
                      ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                      : Text(
                    _isEditMode ? 'Update' : 'Save',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: isIncome ? Colors.green : Colors.red,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    _otherCategoryController.dispose();
    super.dispose();
  }
}