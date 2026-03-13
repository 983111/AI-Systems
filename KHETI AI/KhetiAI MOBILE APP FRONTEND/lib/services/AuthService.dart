// lib/services/AuthService.dart

import 'package:supabase_flutter/supabase_flutter.dart';
import 'SupabaseConfig.dart';

class AuthService {
  final SupabaseClient _supabase = SupabaseConfig.client;

  User? get currentUser => _supabase.auth.currentUser;
  bool get isLoggedIn => currentUser != null;
  Stream<AuthState> get authStateChanges => _supabase.auth.onAuthStateChange;

  // Sign Up with Email & Password
  Future<void> signUpWithEmail({
    required String email,
    required String password,
    String? fullName,
  }) async {
    try {
      await _supabase.auth.signUp(
        email: email,
        password: password,
        data: fullName != null ? {'full_name': fullName} : null,
        emailRedirectTo: null,
      );
    } catch (e) {
      rethrow;
    }
  }

  // Login with Email & Password
  Future<AuthResponse> loginWithEmailPassword({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );
      return response;
    } catch (e) {
      rethrow;
    }
  }

  // Verify Email OTP (Signup ke baad)
  Future<AuthResponse> verifyEmailOTP({
    required String email,
    required String token,
  }) async {
    try {
      final response = await _supabase.auth.verifyOTP(
        email: email,
        token: token,
        type: OtpType.signup,
      );
      return response;
    } catch (e) {
      rethrow;
    }
  }

  // Forgot Password - Step 1: Send OTP
  Future<void> sendPasswordResetOTP({
    required String email,
  }) async {
    try {
      await _supabase.auth.resetPasswordForEmail(
        email,
        redirectTo: null,
      );
    } catch (e) {
      rethrow;
    }
  }

  // Forgot Password - Step 2: Verify OTP
  Future<AuthResponse> verifyPasswordResetOTP({
    required String email,
    required String token,
  }) async {
    try {
      final response = await _supabase.auth.verifyOTP(
        email: email,
        token: token,
        type: OtpType.recovery,
      );
      return response;
    } catch (e) {
      rethrow;
    }
  }

  // Forgot Password - Step 3: Update Password
  Future<UserResponse> updatePassword({
    required String newPassword,
  }) async {
    try {
      final response = await _supabase.auth.updateUser(
        UserAttributes(password: newPassword),
      );
      return response;
    } catch (e) {
      rethrow;
    }
  }

  // Resend Verification OTP
  Future<void> resendVerificationOTP({
    required String email,
  }) async {
    try {
      await _supabase.auth.resend(
        type: OtpType.signup,
        email: email,
      );
    } catch (e) {
      rethrow;
    }
  }

  // Logout
  Future<void> signOut() async {
    try {
      await _supabase.auth.signOut();
    } catch (e) {
      rethrow;
    }
  }

  // Get User Profile
  Future<Map<String, dynamic>?> getUserProfile() async {
    try {
      if (currentUser == null) return null;

      final response = await _supabase
          .from('users')
          .select()
          .eq('id', currentUser!.id)
          .single();

      return response;
    } catch (e) {
      rethrow;
    }
  }

  // Update User Profile
  Future<void> updateUserProfile({
    String? fullName,
    String? phone,
    String? avatarUrl,
  }) async {
    try {
      if (currentUser == null) throw Exception('User not logged in');

      final updates = <String, dynamic>{
        'updated_at': DateTime.now().toIso8601String(),
      };

      if (fullName != null) updates['full_name'] = fullName;
      if (phone != null) updates['phone'] = phone;
      if (avatarUrl != null) updates['avatar_url'] = avatarUrl;

      await _supabase
          .from('users')
          .update(updates)
          .eq('id', currentUser!.id);
    } catch (e) {
      rethrow;
    }
  }
}