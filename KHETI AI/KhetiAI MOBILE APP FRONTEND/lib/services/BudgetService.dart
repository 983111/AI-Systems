// lib/services/BudgetService.dart

import 'package:supabase_flutter/supabase_flutter.dart';
import 'SupabaseConfig.dart';

enum BudgetFilter { daily, monthly, yearly }

class BudgetService {
  final SupabaseClient _supabase = SupabaseConfig.client;
  String? get _userId => _supabase.auth.currentUser?.id;

  // ========== ADD TRANSACTION ==========
  Future<void> addTransaction({
    required double amount,
    required String type,
    required String category,
    String? description,
    DateTime? date,
  }) async {
    if (_userId == null) throw Exception('User not logged in.');
    await _supabase.from('transactions').insert({
      'user_id': _userId,
      'amount': amount,
      'type': type,
      'category': category,
      'description': description,
      'date': (date ?? DateTime.now()).toIso8601String(),
    });
  }

  // ========== UPDATE TRANSACTION ==========
  Future<void> updateTransaction({
    required String transactionId,
    required double amount,
    required String type,
    required String category,
    String? description,
    DateTime? date,
  }) async {
    if (_userId == null) throw Exception('User not logged in.');
    await _supabase.from('transactions').update({
      'amount': amount,
      'type': type,
      'category': category,
      'description': description,
      'date': (date ?? DateTime.now()).toIso8601String(),
    }).eq('id', transactionId).eq('user_id', _userId!);
  }

  // ========== DELETE TRANSACTION ==========
  Future<void> deleteTransaction(String transactionId) async {
    if (_userId == null) throw Exception('User not logged in.');
    await _supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', _userId!);
  }

  // ========== DAILY: GET TRANSACTIONS FOR SPECIFIC DATE ==========
  Future<List<Map<String, dynamic>>> getTransactionsForDate(DateTime date) async {
    if (_userId == null) return [];

    final startOfDay = DateTime(date.year, date.month, date.day);
    final endOfDay = startOfDay.add(const Duration(days: 1)).subtract(const Duration(seconds: 1));

    final response = await _supabase
        .from('transactions')
        .select()
        .eq('user_id', _userId!)
        .gte('date', startOfDay.toIso8601String())
        .lte('date', endOfDay.toIso8601String())
        .order('date', ascending: false);

    return List<Map<String, dynamic>>.from(response);
  }

  // ========== DAILY: GET SUMMARY FOR SPECIFIC DATE ==========
  Future<Map<String, double>> getSummaryForDate(DateTime date) async {
    if (_userId == null) return {'income': 0.0, 'expense': 0.0};

    final startOfDay = DateTime(date.year, date.month, date.day);
    final endOfDay = startOfDay.add(const Duration(days: 1)).subtract(const Duration(seconds: 1));

    final response = await _supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', _userId!)
        .gte('date', startOfDay.toIso8601String())
        .lte('date', endOfDay.toIso8601String());

    double totalIncome = 0.0;
    double totalExpense = 0.0;

    for (var t in response) {
      final amount = (t['amount'] as num).toDouble();
      if (t['type'] == 'income') {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }
    }

    return {'income': totalIncome, 'expense': totalExpense};
  }

  // ========== MONTHLY: GET TRANSACTIONS FOR SPECIFIC MONTH ==========
  Future<List<Map<String, dynamic>>> getTransactionsForMonth(int year, int month) async {
    if (_userId == null) return [];

    final startOfMonth = DateTime(year, month, 1);
    final endOfMonth = DateTime(year, month + 1, 1).subtract(const Duration(seconds: 1));

    final response = await _supabase
        .from('transactions')
        .select()
        .eq('user_id', _userId!)
        .gte('date', startOfMonth.toIso8601String())
        .lte('date', endOfMonth.toIso8601String())
        .order('date', ascending: false);

    return List<Map<String, dynamic>>.from(response);
  }

  // ========== MONTHLY: GET SUMMARY FOR SPECIFIC MONTH ==========
  Future<Map<String, double>> getSummaryForMonth(int year, int month) async {
    if (_userId == null) return {'income': 0.0, 'expense': 0.0};

    final startOfMonth = DateTime(year, month, 1);
    final endOfMonth = DateTime(year, month + 1, 1).subtract(const Duration(seconds: 1));

    final response = await _supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', _userId!)
        .gte('date', startOfMonth.toIso8601String())
        .lte('date', endOfMonth.toIso8601String());

    double totalIncome = 0.0;
    double totalExpense = 0.0;

    for (var t in response) {
      final amount = (t['amount'] as num).toDouble();
      if (t['type'] == 'income') {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }
    }

    return {'income': totalIncome, 'expense': totalExpense};
  }

  // ========== YEARLY: GET TRANSACTIONS FOR SPECIFIC YEAR ==========
  Future<List<Map<String, dynamic>>> getTransactionsForYear(int year) async {
    if (_userId == null) return [];

    final startOfYear = DateTime(year, 1, 1);
    final endOfYear = DateTime(year + 1, 1, 1).subtract(const Duration(seconds: 1));

    final response = await _supabase
        .from('transactions')
        .select()
        .eq('user_id', _userId!)
        .gte('date', startOfYear.toIso8601String())
        .lte('date', endOfYear.toIso8601String())
        .order('date', ascending: false);

    return List<Map<String, dynamic>>.from(response);
  }

  // ========== YEARLY: GET SUMMARY FOR SPECIFIC YEAR ==========
  Future<Map<String, double>> getSummaryForYear(int year) async {
    if (_userId == null) return {'income': 0.0, 'expense': 0.0};

    final startOfYear = DateTime(year, 1, 1);
    final endOfYear = DateTime(year + 1, 1, 1).subtract(const Duration(seconds: 1));

    final response = await _supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', _userId!)
        .gte('date', startOfYear.toIso8601String())
        .lte('date', endOfYear.toIso8601String());

    double totalIncome = 0.0;
    double totalExpense = 0.0;

    for (var t in response) {
      final amount = (t['amount'] as num).toDouble();
      if (t['type'] == 'income') {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }
    }

    return {'income': totalIncome, 'expense': totalExpense};
  }

  // ========== LEGACY METHODS (for backward compatibility) ==========
  Future<List<Map<String, dynamic>>> getTransactions(BudgetFilter filter) async {
    final now = DateTime.now();
    switch (filter) {
      case BudgetFilter.daily:
        return getTransactionsForDate(now);
      case BudgetFilter.monthly:
        return getTransactionsForMonth(now.year, now.month);
      case BudgetFilter.yearly:
        return getTransactionsForYear(now.year);
    }
  }

  Future<Map<String, double>> getSummary(BudgetFilter filter) async {
    final now = DateTime.now();
    switch (filter) {
      case BudgetFilter.daily:
        return getSummaryForDate(now);
      case BudgetFilter.monthly:
        return getSummaryForMonth(now.year, now.month);
      case BudgetFilter.yearly:
        return getSummaryForYear(now.year);
    }
  }

  // ========== CATEGORIES ==========
  Future<List<String>> getCategories(String type) async {
    if (_userId == null) return [];

    // Default categories
    final defaultIncome = ['Crop Sale', 'Milk', 'Labor', 'Government Subsidy'];
    final defaultExpense = ['Seeds', 'Fertilizer', 'Pesticides', 'Labor', 'Machinery', 'Irrigation', 'Transport'];
    List<String> categories = type == 'income' ? defaultIncome : defaultExpense;

    // Fetch user-specific categories
    final response = await _supabase
        .from('user_categories')
        .select('name')
        .eq('user_id', _userId!)
        .eq('type', type);

    final customCategories = response.map((e) => e['name'] as String).toList();

    // Combine, remove duplicates, and sort
    final allCategories = {...categories, ...customCategories}.toList()..sort();
    allCategories.add('Other'); // Ensure 'Other' is always an option
    return allCategories;
  }

  Future<void> addCategory({required String name, required String type}) async {
    if (_userId == null) throw Exception('User not logged in.');

    // Check if category already exists
    final existing = await _supabase
        .from('user_categories')
        .select()
        .eq('user_id', _userId!)
        .eq('name', name)
        .eq('type', type);

    if (existing.isEmpty) {
      await _supabase.from('user_categories').insert({
        'user_id': _userId,
        'name': name,
        'type': type,
      });
    }
  }
}