// lib/services/SupabaseConfig.dart

import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseConfig {
  // Apne Supabase project ke credentials yahan dalein
  static const String supabaseUrl = 'https://yygwlpwvyflrlepshflv.supabase.co';
  static const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5Z3dscHd2eWZscmxlcHNoZmx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODgxNjYsImV4cCI6MjA3NDk2NDE2Nn0.relY9sv0m40546hsFGJf5ZlPhc0cjBu7IDJvRMOszjs';

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
      ),
    );
  }

  // Supabase client ka shortcut
  static SupabaseClient get client => Supabase.instance.client;

  // Auth helper
  static GoTrueClient get auth => client.auth;
}