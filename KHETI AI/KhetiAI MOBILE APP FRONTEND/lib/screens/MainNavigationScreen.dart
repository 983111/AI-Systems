// lib/screens/MainNavigationScreen.dart
import 'package:flutter/material.dart';
import 'WeatherScreen.dart';
import 'BudgetScreen.dart';
import 'MarketplaceScreen.dart';
import 'PlantDiseaseScreen.dart';
import 'ChatbotScreen.dart';
import 'ProfileScreen.dart';
import 'SettingsScreen.dart';

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  // Define all screens
  final List<Widget> _screens = [
    const WeatherScreen(),      // Tab 0
    const BudgetScreen(),       // Tab 1
    const MarketplaceScreen(),  // Tab 2
    const PlantDiseaseScreen(), // Tab 3
    const ChatbotScreen(),      // Tab 4 - AI CHATBOT
    const ProfileScreen(),      // Tab 5
    const SettingsScreen(),     // Tab 6
  ];

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        elevation: 3,
        backgroundColor: colorScheme.surface,
        indicatorColor: colorScheme.primaryContainer,
        height: 80,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.cloud_outlined),
            selectedIcon: Icon(Icons.cloud),
            label: 'Weather',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet),
            label: 'Budget',
          ),
          NavigationDestination(
            icon: Icon(Icons.store_outlined),
            selectedIcon: Icon(Icons.store),
            label: 'Market',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_florist_outlined),
            selectedIcon: Icon(Icons.local_florist),
            label: 'Plant AI',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            selectedIcon: Icon(Icons.chat_bubble),
            label: 'AI Chat',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Profile',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}
