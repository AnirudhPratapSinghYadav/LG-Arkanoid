import 'package:flutter/material.dart';

class LgTextField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final bool obscureText;
  final int? maxLength;
  final Color accentColor;

  const LgTextField({
    super.key,
    required this.controller,
    required this.label,
    this.obscureText = false,
    this.maxLength,
    this.accentColor = const Color(0xFF00e5ff),
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(
            fontFamily: 'JetBrainsMono',
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: accentColor.withOpacity(0.7),
            letterSpacing: 2,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: accentColor, width: 2),
            borderRadius: BorderRadius.circular(3),
          ),
          child: Padding(
            padding: const EdgeInsets.all(2),
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF0d1117),
                border: Border.all(color: accentColor.withOpacity(0.4), width: 1),
                borderRadius: BorderRadius.circular(2),
              ),
              child: TextField(
                controller: controller,
                obscureText: obscureText,
                maxLength: maxLength,
                style: const TextStyle(
                  fontFamily: 'JetBrainsMono',
                  color: Color(0xFFe8f4f8),
                  fontSize: 14,
                ),
                decoration: const InputDecoration(
                  counterText: '',
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: InputBorder.none,
                ),
                cursorColor: accentColor,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
